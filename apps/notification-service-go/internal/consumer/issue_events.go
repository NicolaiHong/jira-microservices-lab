package consumer

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/example/jira-like-polyglot-microservices/notification-service/internal/domain"
	"github.com/example/jira-like-polyglot-microservices/notification-service/internal/store"
	"github.com/segmentio/kafka-go"
)

type IssueEventConsumer struct {
	reader *kafka.Reader
	dlq    *kafka.Writer
	store  *store.RedisStore
}

type permanentError struct{ err error }

func (e permanentError) Error() string { return e.err.Error() }

func NewIssueEventConsumer(brokers []string, topic string, store *store.RedisStore) *IssueEventConsumer {
	return &IssueEventConsumer{
		reader: kafka.NewReader(kafka.ReaderConfig{
			Brokers: brokers, Topic: topic, GroupID: "notification-service-v1",
			MinBytes: 1, MaxBytes: 10e6, MaxWait: time.Second,
		}),
		dlq: &kafka.Writer{
			Addr: kafka.TCP(brokers...), Topic: topic + ".dlq.v1",
			Balancer: &kafka.LeastBytes{}, RequiredAcks: kafka.RequireAll,
		},
		store: store,
	}
}

func (c *IssueEventConsumer) Run(ctx context.Context) {
	for {
		message, err := c.reader.FetchMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf(`{"service":"notification-service","message":"kafka_fetch_failed","error":%q}`, err.Error())
			time.Sleep(time.Second)
			continue
		}

		if err := c.handle(ctx, message.Value); err != nil {
			log.Printf(`{"service":"notification-service","message":"event_processing_failed","error":%q}`, err.Error())
			if _, permanent := err.(permanentError); permanent {
				if dlqErr := c.dlq.WriteMessages(ctx, kafka.Message{
					Key: message.Key, Value: message.Value,
					Headers: []kafka.Header{{Key: "failure-reason", Value: []byte(err.Error())}},
				}); dlqErr == nil {
					_ = c.reader.CommitMessages(ctx, message)
				}
				continue
			}
			time.Sleep(time.Second)
			continue
		}
		if err := c.reader.CommitMessages(ctx, message); err != nil {
			log.Printf(`{"service":"notification-service","message":"kafka_commit_failed","error":%q}`, err.Error())
		}
	}
}

func (c *IssueEventConsumer) Close() error {
	_ = c.dlq.Close()
	return c.reader.Close()
}

func (c *IssueEventConsumer) handle(ctx context.Context, raw []byte) error {
	var event domain.IssueEvent
	if err := json.Unmarshal(raw, &event); err != nil {
		return permanentError{fmt.Errorf("decode issue event: %w", err)}
	}
	if event.SchemaVersion != 1 || event.EventID == "" || event.AggregateID == "" {
		return permanentError{fmt.Errorf("unsupported or incomplete event envelope")}
	}

	recipients := stringsFrom(event.Payload["recipientUserIds"])
	notifications := make([]domain.Notification, 0, len(recipients))
	for _, userID := range recipients {
		title, body := content(event)
		notifications = append(notifications, domain.Notification{
			ID: store.DeterministicID(event.EventID, userID), UserID: userID,
			EventID: event.EventID, Type: event.EventType, Title: title, Body: body,
			IssueID: event.AggregateID, ProjectID: event.ProjectID, CreatedAt: event.OccurredAt,
		})
	}
	if event.OccurredAt.IsZero() {
		for i := range notifications {
			notifications[i].CreatedAt = time.Now().UTC()
		}
	}
	if err := c.store.SaveEventNotifications(ctx, notifications); err != nil {
		return fmt.Errorf("save notifications: %w", err)
	}
	log.Printf(
		`{"service":"notification-service","eventId":%q,"eventType":%q,"recipientCount":%d,"message":"event_consumed"}`,
		event.EventID, event.EventType, len(notifications),
	)
	return nil
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

func stringsFrom(value any) []string {
	items, ok := value.([]any)
	if !ok {
		return nil
	}
	result := make([]string, 0, len(items))
	for _, item := range items {
		if text, ok := item.(string); ok && text != "" {
			result = append(result, text)
		}
	}
	return result
}
