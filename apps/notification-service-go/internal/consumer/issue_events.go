package consumer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/example/jira-like-polyglot-microservices/notification-service/internal/domain"
	"github.com/example/jira-like-polyglot-microservices/notification-service/internal/projectaccess"
	"github.com/example/jira-like-polyglot-microservices/notification-service/internal/store"
	"github.com/segmentio/kafka-go"
)

const (
	defaultMaxProcessAttempts = 5
	defaultMaxCommitAttempts  = 3
	defaultRetryDelay         = time.Second
)

type kafkaReader interface {
	FetchMessage(context.Context) (kafka.Message, error)
	CommitMessages(context.Context, ...kafka.Message) error
	Close() error
}

type kafkaWriter interface {
	WriteMessages(context.Context, ...kafka.Message) error
	Close() error
}

type notificationStore interface {
	SaveEventNotifications(context.Context, []domain.Notification) error
}

type retryPolicy struct {
	maxProcessAttempts int
	maxCommitAttempts  int
	retryDelay         time.Duration
}

type IssueEventConsumer struct {
	reader        kafkaReader
	dlq           kafkaWriter
	store         notificationStore
	accessChecker projectaccess.Checker
	retry         retryPolicy
}

type permanentError struct{ err error }

func (e permanentError) Error() string { return e.err.Error() }
func (e permanentError) Unwrap() error { return e.err }

type pendingStage int

const (
	processPending pendingStage = iota
	dlqPending
	commitPending
)

type pendingMessage struct {
	message         kafka.Message
	stage           pendingStage
	processAttempts int
	failure         error
}

func NewIssueEventConsumer(
	brokers []string,
	topic string,
	notificationStore *store.RedisStore,
	accessChecker projectaccess.Checker,
) *IssueEventConsumer {
	return newIssueEventConsumer(
		kafka.NewReader(kafka.ReaderConfig{
			Brokers: brokers, Topic: topic, GroupID: "notification-service-v1",
			MinBytes: 1, MaxBytes: 10e6, MaxWait: time.Second,
		}),
		&kafka.Writer{
			Addr: kafka.TCP(brokers...), Topic: topic + ".dlq.v1",
			Balancer: &kafka.LeastBytes{}, RequiredAcks: kafka.RequireAll,
		},
		notificationStore,
		accessChecker,
		retryPolicy{
			maxProcessAttempts: defaultMaxProcessAttempts,
			maxCommitAttempts:  defaultMaxCommitAttempts,
			retryDelay:         defaultRetryDelay,
		},
	)
}

func newIssueEventConsumer(
	reader kafkaReader,
	dlq kafkaWriter,
	notificationStore notificationStore,
	accessChecker projectaccess.Checker,
	retry retryPolicy,
) *IssueEventConsumer {
	if retry.maxProcessAttempts < 1 {
		retry.maxProcessAttempts = 1
	}
	if retry.maxCommitAttempts < 1 {
		retry.maxCommitAttempts = 1
	}
	if retry.retryDelay < 0 {
		retry.retryDelay = 0
	}
	return &IssueEventConsumer{
		reader: reader, dlq: dlq, store: notificationStore,
		accessChecker: accessChecker, retry: retry,
	}
}

// Run processes at most one fetched record at a time. A record remains pending
// until either its projection or DLQ write has been committed, preventing a
// later fetched offset from committing past a failed earlier record.
func (c *IssueEventConsumer) Run(ctx context.Context) {
	var pending *pendingMessage

	for {
		if pending == nil {
			message, err := c.reader.FetchMessage(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				log.Printf(`{"service":"notification-service","message":"kafka_fetch_failed","error":%q}`, err.Error())
				if !waitForRetry(ctx, c.retry.retryDelay) {
					return
				}
				continue
			}
			pending = &pendingMessage{message: message, stage: processPending}
		}

		switch pending.stage {
		case processPending:
			err := c.handle(ctx, pending.message.Value)
			if err == nil {
				pending.stage = commitPending
				continue
			}

			pending.processAttempts++
			pending.failure = err
			if isPermanent(err) || pending.processAttempts >= c.retry.maxProcessAttempts {
				pending.stage = dlqPending
				continue
			}

			log.Printf(`{"service":"notification-service","message":"event_processing_failed","attempt":%d,"error":%q}`,
				pending.processAttempts, err.Error())
			if !waitForRetry(ctx, c.retry.retryDelay) {
				return
			}

		case dlqPending:
			if err := c.writeDLQ(ctx, pending.message, pending.failure); err != nil {
				if ctx.Err() != nil {
					return
				}
				log.Printf(`{"service":"notification-service","message":"kafka_dlq_failed","error":%q}`, err.Error())
				if !waitForRetry(ctx, c.retry.retryDelay) {
					return
				}
				continue
			}
			pending.stage = commitPending

		case commitPending:
			if c.commit(ctx, pending.message) {
				pending = nil
				continue
			}
			if ctx.Err() != nil {
				return
			}
			// A bounded commit batch failed. Keep the same pending record and
			// wait before beginning another bounded batch; never fetch later work.
			if !waitForRetry(ctx, c.retry.retryDelay) {
				return
			}
		}
	}
}

func (c *IssueEventConsumer) Close() error {
	readerErr := c.reader.Close()
	dlqErr := c.dlq.Close()
	return errors.Join(readerErr, dlqErr)
}

func (c *IssueEventConsumer) handle(ctx context.Context, raw []byte) error {
	var event domain.IssueEvent
	if err := json.Unmarshal(raw, &event); err != nil {
		return permanentError{fmt.Errorf("decode issue event: %w", err)}
	}
	if err := validateEvent(event); err != nil {
		return permanentError{err}
	}
	if c.accessChecker == nil {
		return errors.New("project access checker is unavailable")
	}

	recipients := normalizedRecipients(event.Payload["recipientUserIds"], event.ActorUserID)
	if len(recipients) == 0 {
		c.logConsumed(event, 0)
		return nil
	}

	eligibleRecipients := make([]string, 0, len(recipients))
	for _, userID := range recipients {
		decision, err := c.accessChecker.CheckAccess(ctx, event.ProjectID, userID, event.EventID)
		if err != nil {
			return fmt.Errorf("verify current project access for recipient %q: %w", userID, err)
		}
		switch decision {
		case projectaccess.Eligible:
			eligibleRecipients = append(eligibleRecipients, userID)
		case projectaccess.NotEligible:
			// The documented PROJECT_NOT_FOUND response maps to a recipient skip.
		default:
			return fmt.Errorf("unknown project access decision for recipient %q", userID)
		}
	}

	if len(eligibleRecipients) == 0 {
		c.logConsumed(event, 0)
		return nil
	}

	title, body := content(event)
	notifications := make([]domain.Notification, 0, len(eligibleRecipients))
	for _, userID := range eligibleRecipients {
		notifications = append(notifications, domain.Notification{
			ID:        store.DeterministicID(event.EventID, userID),
			UserID:    userID,
			EventID:   event.EventID,
			Type:      event.EventType,
			Title:     title,
			Body:      body,
			IssueID:   event.AggregateID,
			ProjectID: event.ProjectID,
			CreatedAt: event.OccurredAt,
		})
	}
	if event.OccurredAt.IsZero() {
		for i := range notifications {
			notifications[i].CreatedAt = time.Now().UTC()
		}
	}

	// SaveEventNotifications is the existing single Redis pipeline. It is called
	// only after every remaining recipient's access has been successfully checked.
	if err := c.store.SaveEventNotifications(ctx, notifications); err != nil {
		return fmt.Errorf("save notifications: %w", err)
	}
	c.logConsumed(event, len(notifications))
	return nil
}

func (c *IssueEventConsumer) logConsumed(event domain.IssueEvent, recipientCount int) {
	log.Printf(
		`{"service":"notification-service","eventId":%q,"eventType":%q,"recipientCount":%d,"message":"event_consumed"}`,
		event.EventID, event.EventType, recipientCount,
	)
}

func (c *IssueEventConsumer) writeDLQ(ctx context.Context, message kafka.Message, reason error) error {
	headers := append([]kafka.Header(nil), message.Headers...)
	headers = append(headers, kafka.Header{Key: "failure-reason", Value: []byte(reason.Error())})
	return c.dlq.WriteMessages(ctx, kafka.Message{
		Key: message.Key, Value: message.Value, Headers: headers,
	})
}

func (c *IssueEventConsumer) commit(ctx context.Context, message kafka.Message) bool {
	for attempt := 1; attempt <= c.retry.maxCommitAttempts; attempt++ {
		if err := c.reader.CommitMessages(ctx, message); err == nil {
			return true
		} else if ctx.Err() != nil {
			return false
		} else {
			log.Printf(`{"service":"notification-service","message":"kafka_commit_failed","attempt":%d,"error":%q}`,
				attempt, err.Error())
		}

		if attempt < c.retry.maxCommitAttempts && !waitForRetry(ctx, c.retry.retryDelay) {
			return false
		}
	}
	return false
}

func waitForRetry(ctx context.Context, delay time.Duration) bool {
	if delay == 0 {
		return ctx.Err() == nil
	}
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

func isPermanent(err error) bool {
	var permanent permanentError
	return errors.As(err, &permanent)
}

func validateEvent(event domain.IssueEvent) error {
	if event.SchemaVersion != 1 || strings.TrimSpace(event.EventID) == "" || strings.TrimSpace(event.AggregateID) == "" || strings.TrimSpace(event.ProjectID) == "" {
		return errors.New("unsupported or incomplete event envelope")
	}
	switch event.EventType {
	case "issue.created", "issue.updated", "issue.assigned", "issue.transitioned", "issue.commented":
		return nil
	default:
		return fmt.Errorf("unsupported issue event type %q", event.EventType)
	}
}

func normalizedRecipients(value any, actorUserID string) []string {
	seen := make(map[string]struct{})
	actorUserID = normalizeUserID(actorUserID)
	result := make([]string, 0)
	for _, userID := range stringsFrom(value) {
		normalized := normalizeUserID(userID)
		if normalized == "" || normalized == actorUserID {
			continue
		}
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		result = append(result, normalized)
	}
	return result
}

func normalizeUserID(userID string) string {
	return strings.ToLower(strings.TrimSpace(userID))
}

func stringsFrom(value any) []string {
	switch items := value.(type) {
	case []any:
		result := make([]string, 0, len(items))
		for _, item := range items {
			if text, ok := item.(string); ok {
				result = append(result, text)
			}
		}
		return result
	case []string:
		return append([]string(nil), items...)
	default:
		return nil
	}
}

func content(event domain.IssueEvent) (string, string) {
	issueKey, _ := event.Payload["issueKey"].(string)
	switch event.EventType {
	case "issue.created":
		return "Issue assigned", fmt.Sprintf("%s was created and assigned to you", issueKey)
	case "issue.assigned":
		return "Issue assignment changed", fmt.Sprintf("Assignment changed on %s", issueKey)
	case "issue.transitioned":
		return "Issue status changed", fmt.Sprintf("%s moved to %v", issueKey, event.Payload["toStatus"])
	case "issue.commented":
		return "New issue comment", fmt.Sprintf("A comment was added to %s", issueKey)
	default:
		return "Issue updated", fmt.Sprintf("%s was updated", issueKey)
	}
}
