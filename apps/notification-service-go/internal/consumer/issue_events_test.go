package consumer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/example/jira-like-polyglot-microservices/notification-service/internal/domain"
	"github.com/example/jira-like-polyglot-microservices/notification-service/internal/projectaccess"
	"github.com/segmentio/kafka-go"
)

const (
	consumerTestEventID   = "event-123"
	consumerTestProjectID = "project-123"
	consumerTestIssueID   = "issue-123"
)

type accessCall struct {
	projectID     string
	userID        string
	correlationID string
}

type accessResult struct {
	decision projectaccess.Decision
	err      error
}

type fakeAccessChecker struct {
	results  []accessResult
	fallback *accessResult
	calls    []accessCall
}

func (f *fakeAccessChecker) CheckAccess(
	_ context.Context,
	projectID string,
	userID string,
	correlationID string,
) (projectaccess.Decision, error) {
	f.calls = append(f.calls, accessCall{
		projectID: projectID, userID: userID, correlationID: correlationID,
	})
	resultIndex := len(f.calls) - 1
	if resultIndex >= len(f.results) {
		if f.fallback != nil {
			return f.fallback.decision, f.fallback.err
		}
		return projectaccess.Eligible, nil
	}
	result := f.results[resultIndex]
	return result.decision, result.err
}

type fakeNotificationStore struct {
	batches [][]domain.Notification
	err     error
}

func (f *fakeNotificationStore) SaveEventNotifications(
	_ context.Context,
	notifications []domain.Notification,
) error {
	copyOfNotifications := append([]domain.Notification(nil), notifications...)
	f.batches = append(f.batches, copyOfNotifications)
	return f.err
}

type fakeReader struct {
	messages      []kafka.Message
	next          int
	fetchOffsets  []int64
	commitOffsets []int64
	commitResults []error
	commitCalls   int
	commitHook    func(kafka.Message, error)
}

func (f *fakeReader) FetchMessage(ctx context.Context) (kafka.Message, error) {
	if err := ctx.Err(); err != nil {
		return kafka.Message{}, err
	}
	if f.next < len(f.messages) {
		message := f.messages[f.next]
		f.next++
		f.fetchOffsets = append(f.fetchOffsets, message.Offset)
		return message, nil
	}
	<-ctx.Done()
	return kafka.Message{}, ctx.Err()
}

func (f *fakeReader) CommitMessages(_ context.Context, messages ...kafka.Message) error {
	message := messages[0]
	f.commitOffsets = append(f.commitOffsets, message.Offset)
	var result error
	if f.commitCalls < len(f.commitResults) {
		result = f.commitResults[f.commitCalls]
	}
	f.commitCalls++
	if f.commitHook != nil {
		f.commitHook(message, result)
	}
	return result
}

func (f *fakeReader) Close() error { return nil }

type fakeDLQWriter struct {
	messages  []kafka.Message
	err       error
	writeHook func()
}

func (f *fakeDLQWriter) WriteMessages(_ context.Context, messages ...kafka.Message) error {
	f.messages = append(f.messages, messages...)
	if f.writeHook != nil {
		f.writeHook()
	}
	return f.err
}

func (f *fakeDLQWriter) Close() error { return nil }

func TestHandleRevalidatesEveryIssueEventTypeWithNormalizedRecipients(t *testing.T) {
	eventTypes := []string{
		"issue.created",
		"issue.updated",
		"issue.assigned",
		"issue.transitioned",
		"issue.commented",
	}

	for _, eventType := range eventTypes {
		t.Run(eventType, func(t *testing.T) {
			access := &fakeAccessChecker{}
			projection := &fakeNotificationStore{}
			consumer := newIssueEventConsumer(nil, nil, projection, access, testRetryPolicy())

			err := consumer.handle(context.Background(), issueEvent(t, eventType,
				[]any{" Recipient-A ", "recipient-a", "ACTOR-A", ""}, "actor-a"))
			if err != nil {
				t.Fatalf("handle() error = %v", err)
			}
			if len(access.calls) != 1 {
				t.Fatalf("access checks = %d, want 1", len(access.calls))
			}
			call := access.calls[0]
			if call.projectID != consumerTestProjectID || call.userID != "recipient-a" || call.correlationID != consumerTestEventID {
				t.Fatalf("access call = %#v", call)
			}
			if len(projection.batches) != 1 || len(projection.batches[0]) != 1 {
				t.Fatalf("Redis batches = %#v, want one normalized recipient", projection.batches)
			}
			notification := projection.batches[0][0]
			if notification.UserID != "recipient-a" {
				t.Fatalf("notification userID = %q", notification.UserID)
			}
			if notification.ID == "" || notification.ID != deterministicNotificationID() {
				t.Fatalf("notification deterministic ID = %q", notification.ID)
			}
		})
	}
}

func TestHandleProjectsOnlyEligibleRecipientsInOneBatch(t *testing.T) {
	tests := []struct {
		name        string
		results     []accessResult
		wantUsers   []string
		wantBatches int
		wantChecks  int
	}{
		{
			name:        "all eligible",
			results:     []accessResult{{decision: projectaccess.Eligible}, {decision: projectaccess.Eligible}},
			wantUsers:   []string{"recipient-a", "recipient-b"},
			wantBatches: 1,
			wantChecks:  2,
		},
		{
			name:        "mixed current and removed members",
			results:     []accessResult{{decision: projectaccess.Eligible}, {decision: projectaccess.NotEligible}},
			wantUsers:   []string{"recipient-a"},
			wantBatches: 1,
			wantChecks:  2,
		},
		{
			name:        "all members removed",
			results:     []accessResult{{decision: projectaccess.NotEligible}, {decision: projectaccess.NotEligible}},
			wantBatches: 0,
			wantChecks:  2,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			access := &fakeAccessChecker{results: test.results}
			projection := &fakeNotificationStore{}
			consumer := newIssueEventConsumer(nil, nil, projection, access, testRetryPolicy())
			err := consumer.handle(context.Background(), issueEvent(t, "issue.updated",
				[]any{"recipient-a", "recipient-b"}, "actor-a"))
			if err != nil {
				t.Fatalf("handle() error = %v", err)
			}
			if len(access.calls) != test.wantChecks {
				t.Fatalf("access checks = %d, want %d", len(access.calls), test.wantChecks)
			}
			if len(projection.batches) != test.wantBatches {
				t.Fatalf("Redis batches = %d, want %d", len(projection.batches), test.wantBatches)
			}
			if test.wantBatches == 1 {
				if len(projection.batches[0]) != len(test.wantUsers) {
					t.Fatalf("notifications = %#v, want users %#v", projection.batches[0], test.wantUsers)
				}
				for index, userID := range test.wantUsers {
					if got := projection.batches[0][index].UserID; got != userID {
						t.Fatalf("notification %d userID = %q, want %q", index, got, userID)
					}
				}
			}
		})
	}
}

func TestHandleZeroRecipientsDoesNotCallProjectOrRedis(t *testing.T) {
	access := &fakeAccessChecker{}
	projection := &fakeNotificationStore{}
	consumer := newIssueEventConsumer(nil, nil, projection, access, testRetryPolicy())

	err := consumer.handle(context.Background(), issueEvent(t, "issue.commented", []any{"actor-a", " ACTOR-A "}, "actor-a"))
	if err != nil {
		t.Fatalf("handle() error = %v", err)
	}
	if len(access.calls) != 0 {
		t.Fatalf("access checks = %d, want 0", len(access.calls))
	}
	if len(projection.batches) != 0 {
		t.Fatalf("Redis batches = %d, want 0", len(projection.batches))
	}
}

func TestProjectAccessFailuresAreRetryableAndLeaveRedisUntouched(t *testing.T) {
	failures := []struct {
		name string
		err  error
	}{
		{name: "project timeout", err: context.DeadlineExceeded},
		{name: "project service 5xx", err: errors.New("unexpected project access response status 503")},
		{name: "malformed successful response", err: errors.New("decode project access context: invalid character")},
		{name: "internal authentication rejected", err: errors.New("unexpected project access response status 401")},
		{name: "invalid access client configuration", err: errors.New("PROJECT_SERVICE_URL must use http or https")},
	}

	for _, failure := range failures {
		t.Run(failure.name, func(t *testing.T) {
			access := &fakeAccessChecker{results: []accessResult{
				{decision: projectaccess.Eligible},
				{err: failure.err},
			}}
			projection := &fakeNotificationStore{}
			consumer := newIssueEventConsumer(nil, nil, projection, access, testRetryPolicy())

			err := consumer.handle(context.Background(), issueEvent(t, "issue.assigned",
				[]any{"recipient-a", "recipient-b"}, "actor-a"))
			if err == nil {
				t.Fatal("handle() error = nil, want dependency error")
			}
			if isPermanent(err) {
				t.Fatalf("access error became permanent: %v", err)
			}
			if len(access.calls) != 2 {
				t.Fatalf("access checks = %d, want 2", len(access.calls))
			}
			if len(projection.batches) != 0 {
				t.Fatalf("Redis batches = %d, want zero before all checks complete", len(projection.batches))
			}
		})
	}
}

func TestRunRetriesTheSameFailedRecordBeforeCommit(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	reader := &fakeReader{messages: []kafka.Message{{Offset: 7, Value: issueEvent(t, "issue.updated", []any{"recipient-a"}, "actor-a")}}}
	reader.commitHook = func(_ kafka.Message, result error) {
		if result == nil {
			cancel()
		}
	}
	access := &fakeAccessChecker{results: []accessResult{
		{err: errors.New("project service unavailable")},
		{decision: projectaccess.Eligible},
	}}
	projection := &fakeNotificationStore{}
	consumer := newIssueEventConsumer(reader, &fakeDLQWriter{}, projection, access, retryPolicy{
		maxProcessAttempts: 3, maxCommitAttempts: 1, retryDelay: time.Millisecond,
	})

	consumer.Run(ctx)

	if got := len(access.calls); got != 2 {
		t.Fatalf("access attempts = %d, want 2 for the same fetched record", got)
	}
	if got := reader.fetchOffsets; len(got) != 1 || got[0] != 7 {
		t.Fatalf("fetched offsets = %v, want only 7", got)
	}
	if got := reader.commitOffsets; len(got) != 1 || got[0] != 7 {
		t.Fatalf("committed offsets = %v, want only 7", got)
	}
	if len(projection.batches) != 1 {
		t.Fatalf("Redis batches = %d, want 1", len(projection.batches))
	}
}

func TestRunDoesNotCommitPastRetryableFailure(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Millisecond)
	defer cancel()
	reader := &fakeReader{messages: []kafka.Message{
		{Offset: 10, Value: issueEvent(t, "issue.updated", []any{"recipient-a"}, "actor-a")},
		{Offset: 11, Value: issueEvent(t, "issue.updated", []any{"recipient-b"}, "actor-a")},
	}}
	accessFailure := accessResult{err: errors.New("project service unavailable")}
	access := &fakeAccessChecker{results: []accessResult{accessFailure}, fallback: &accessFailure}
	projection := &fakeNotificationStore{}
	consumer := newIssueEventConsumer(reader, &fakeDLQWriter{}, projection, access, retryPolicy{
		maxProcessAttempts: 100, maxCommitAttempts: 1, retryDelay: time.Millisecond,
	})

	consumer.Run(ctx)

	if got := reader.fetchOffsets; len(got) != 1 || got[0] != 10 {
		t.Fatalf("fetched offsets = %v, want only failed offset 10", got)
	}
	if len(reader.commitOffsets) != 0 {
		t.Fatalf("commits = %v, want none", reader.commitOffsets)
	}
	if len(projection.batches) != 0 {
		t.Fatalf("Redis batches = %d, want none", len(projection.batches))
	}
}

func TestRunWritesDLQThenCommits(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	reader := &fakeReader{messages: []kafka.Message{{Offset: 20, Value: []byte(`not-json`)}}}
	reader.commitHook = func(_ kafka.Message, result error) {
		if result == nil {
			cancel()
		}
	}
	dlq := &fakeDLQWriter{}
	consumer := newIssueEventConsumer(reader, dlq, &fakeNotificationStore{}, &fakeAccessChecker{}, testRetryPolicy())

	consumer.Run(ctx)

	if got := len(dlq.messages); got != 1 {
		t.Fatalf("DLQ writes = %d, want 1", got)
	}
	if got := reader.commitOffsets; len(got) != 1 || got[0] != 20 {
		t.Fatalf("committed offsets = %v, want 20 after DLQ success", got)
	}
	if got := dlq.messages[0].Headers[len(dlq.messages[0].Headers)-1].Key; got != "failure-reason" {
		t.Fatalf("DLQ failure header = %q", got)
	}
}

func TestRunDoesNotCommitWhenDLQWriteFails(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	reader := &fakeReader{messages: []kafka.Message{{Offset: 30, Value: []byte(`not-json`)}}}
	dlq := &fakeDLQWriter{
		err:       errors.New("DLQ unavailable"),
		writeHook: cancel,
	}
	consumer := newIssueEventConsumer(reader, dlq, &fakeNotificationStore{}, &fakeAccessChecker{}, testRetryPolicy())

	consumer.Run(ctx)

	if got := len(dlq.messages); got != 1 {
		t.Fatalf("DLQ writes = %d, want 1", got)
	}
	if len(reader.commitOffsets) != 0 {
		t.Fatalf("commits = %v, want no commit when DLQ write fails", reader.commitOffsets)
	}
	if got := reader.fetchOffsets; len(got) != 1 || got[0] != 30 {
		t.Fatalf("fetched offsets = %v, want only 30", got)
	}
}

func TestRunRetriesCommitBeforeFetchingLaterRecord(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	commitFailure := errors.New("commit unavailable")
	reader := &fakeReader{
		messages: []kafka.Message{
			{Offset: 40, Value: issueEvent(t, "issue.created", []any{"recipient-a"}, "actor-a")},
			{Offset: 41, Value: issueEvent(t, "issue.created", []any{"recipient-b"}, "actor-a")},
		},
		commitResults: []error{commitFailure, nil},
	}
	reader.commitHook = func(message kafka.Message, result error) {
		if message.Offset == 40 && result == nil {
			cancel()
		}
	}
	consumer := newIssueEventConsumer(reader, &fakeDLQWriter{}, &fakeNotificationStore{}, &fakeAccessChecker{}, retryPolicy{
		maxProcessAttempts: 1, maxCommitAttempts: 3, retryDelay: time.Millisecond,
	})

	consumer.Run(ctx)

	if got := reader.commitOffsets; fmt.Sprint(got) != "[40 40]" {
		t.Fatalf("commit sequence = %v, want [40 40]", got)
	}
	if got := reader.fetchOffsets; len(got) != 1 || got[0] != 40 {
		t.Fatalf("fetched offsets = %v, must not advance to 41 before commit of 40", got)
	}
}

func TestRunDoesNotFetchLaterRecordWhenCommitBatchIsExhausted(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	commitFailure := errors.New("commit unavailable")
	reader := &fakeReader{
		messages: []kafka.Message{
			{Offset: 45, Value: issueEvent(t, "issue.created", []any{"recipient-a"}, "actor-a")},
			{Offset: 46, Value: issueEvent(t, "issue.created", []any{"recipient-b"}, "actor-a")},
		},
		commitResults: []error{commitFailure, commitFailure},
	}
	reader.commitHook = func(_ kafka.Message, _ error) {
		if reader.commitCalls == 2 {
			cancel()
		}
	}
	consumer := newIssueEventConsumer(reader, &fakeDLQWriter{}, &fakeNotificationStore{}, &fakeAccessChecker{}, retryPolicy{
		maxProcessAttempts: 1, maxCommitAttempts: 2, retryDelay: time.Millisecond,
	})

	consumer.Run(ctx)

	if got := reader.commitOffsets; fmt.Sprint(got) != "[45 45]" {
		t.Fatalf("commit sequence = %v, want exactly one bounded batch [45 45]", got)
	}
	if got := reader.fetchOffsets; len(got) != 1 || got[0] != 45 {
		t.Fatalf("fetched offsets = %v, must not advance to 46 after commit batch failure", got)
	}
}

func TestRunShutdownWithUncommittedRecordDoesNotAdvance(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	reader := &fakeReader{messages: []kafka.Message{
		{Offset: 50, Value: issueEvent(t, "issue.commented", []any{"recipient-a"}, "actor-a")},
		{Offset: 51, Value: issueEvent(t, "issue.commented", []any{"recipient-b"}, "actor-a")},
	}}
	reader.commitResults = []error{errors.New("commit interrupted by shutdown")}
	reader.commitHook = func(_ kafka.Message, _ error) { cancel() }
	consumer := newIssueEventConsumer(reader, &fakeDLQWriter{}, &fakeNotificationStore{}, &fakeAccessChecker{}, testRetryPolicy())

	consumer.Run(ctx)

	if got := reader.fetchOffsets; len(got) != 1 || got[0] != 50 {
		t.Fatalf("fetched offsets = %v, must not advance after shutdown", got)
	}
	if got := reader.commitOffsets; len(got) != 1 || got[0] != 50 {
		t.Fatalf("commit attempts = %v, want one interrupted attempt for 50", got)
	}
}

func issueEvent(t *testing.T, eventType string, recipients []any, actorUserID string) []byte {
	t.Helper()
	raw, err := json.Marshal(map[string]any{
		"eventId":          consumerTestEventID,
		"eventType":        eventType,
		"schemaVersion":    1,
		"aggregateId":      consumerTestIssueID,
		"aggregateVersion": 1,
		"projectId":        consumerTestProjectID,
		"actorUserId":      actorUserID,
		"occurredAt":       "2026-08-24T01:02:03Z",
		"payload": map[string]any{
			"issueKey":         "ABC-1",
			"recipientUserIds": recipients,
		},
	})
	if err != nil {
		t.Fatalf("marshal test event: %v", err)
	}
	return raw
}

func deterministicNotificationID() string {
	// Deterministic notification IDs are independently covered in store tests;
	// this check proves the consumer uses the normalized recipient identity.
	return "dea38b66818d1351b9f6626d095f6f71"
}

func testRetryPolicy() retryPolicy {
	return retryPolicy{
		maxProcessAttempts: 3,
		maxCommitAttempts:  2,
		retryDelay:         time.Millisecond,
	}
}
