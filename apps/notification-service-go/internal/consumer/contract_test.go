package consumer

import (
	"bytes"
	"context"
	"path/filepath"
	"testing"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

// A schema-valid issue.events.v1 envelope for every supported event type.
var issueEventFixtures = map[string]string{
	"issue.created":      `{"eventId":"0f1e2d3c-4b5a-4968-8778-695a4b3c2d1e","eventType":"issue.created","schemaVersion":1,"aggregateId":"7d6c5b4a-3f2e-4d1c-8b0a-9f8e7d6c5b4a","aggregateVersion":1,"projectId":"5a4c1f8e-2b7d-4e3a-8c61-9d0e7f6a5b42","actorUserId":"11111111-1111-4111-8111-111111111111","occurredAt":"2026-09-25T08:00:00.000Z","payload":{"issueKey":"LRN-1","summary":"Contract issue","reporterUserId":"11111111-1111-4111-8111-111111111111","assigneeUserId":"22222222-2222-4222-8222-222222222222","recipientUserIds":["22222222-2222-4222-8222-222222222222"]}}`,
	"issue.updated":      `{"eventId":"1f1e2d3c-4b5a-4968-8778-695a4b3c2d1e","eventType":"issue.updated","schemaVersion":1,"aggregateId":"7d6c5b4a-3f2e-4d1c-8b0a-9f8e7d6c5b4a","aggregateVersion":2,"projectId":"5a4c1f8e-2b7d-4e3a-8c61-9d0e7f6a5b42","actorUserId":"11111111-1111-4111-8111-111111111111","occurredAt":"2026-09-25T08:01:00.000Z","payload":{"issueKey":"LRN-1","recipientUserIds":["22222222-2222-4222-8222-222222222222"]}}`,
	"issue.assigned":     `{"eventId":"2f1e2d3c-4b5a-4968-8778-695a4b3c2d1e","eventType":"issue.assigned","schemaVersion":1,"aggregateId":"7d6c5b4a-3f2e-4d1c-8b0a-9f8e7d6c5b4a","aggregateVersion":3,"projectId":"5a4c1f8e-2b7d-4e3a-8c61-9d0e7f6a5b42","actorUserId":"11111111-1111-4111-8111-111111111111","occurredAt":"2026-09-25T08:02:00.000Z","payload":{"issueKey":"LRN-1","recipientUserIds":["22222222-2222-4222-8222-222222222222"]}}`,
	"issue.transitioned": `{"eventId":"3f1e2d3c-4b5a-4968-8778-695a4b3c2d1e","eventType":"issue.transitioned","schemaVersion":1,"aggregateId":"7d6c5b4a-3f2e-4d1c-8b0a-9f8e7d6c5b4a","aggregateVersion":4,"projectId":"5a4c1f8e-2b7d-4e3a-8c61-9d0e7f6a5b42","actorUserId":"11111111-1111-4111-8111-111111111111","occurredAt":"2026-09-25T08:03:00.000Z","payload":{"issueKey":"LRN-1","fromStatus":"TODO","toStatus":"IN_PROGRESS","recipientUserIds":["22222222-2222-4222-8222-222222222222"]}}`,
	"issue.commented":    `{"eventId":"4f1e2d3c-4b5a-4968-8778-695a4b3c2d1e","eventType":"issue.commented","schemaVersion":1,"aggregateId":"7d6c5b4a-3f2e-4d1c-8b0a-9f8e7d6c5b4a","aggregateVersion":5,"projectId":"5a4c1f8e-2b7d-4e3a-8c61-9d0e7f6a5b42","actorUserId":"11111111-1111-4111-8111-111111111111","occurredAt":"2026-09-25T08:04:00.000Z","payload":{"issueKey":"LRN-1","commentId":"1e2d3c4b-5a69-4788-9a0b-c1d2e3f4a5b6","commentPreview":"Contract comment","recipientUserIds":["22222222-2222-4222-8222-222222222222"]}}`,
}

func TestConsumerProjectsEverySchemaValidIssueEvent(t *testing.T) {
	schema := contractSchema(t, "events/issue-event-v1.schema.json", "")
	for eventType, fixture := range issueEventFixtures {
		t.Run(eventType, func(t *testing.T) {
			assertContract(t, schema, fixture)
			projection := &fakeNotificationStore{}
			consumer := newIssueEventConsumer(nil, nil, projection, &fakeAccessChecker{}, testRetryPolicy())
			if err := consumer.handle(context.Background(), []byte(fixture)); err != nil {
				t.Fatalf("handle() error = %v", err)
			}
			if len(projection.batches) != 1 || len(projection.batches[0]) != 1 {
				t.Fatalf("Redis batches = %#v, want one notification", projection.batches)
			}
			notification := projection.batches[0][0]
			if notification.Type != eventType || notification.UserID != "22222222-2222-4222-8222-222222222222" ||
				notification.IssueID != "7d6c5b4a-3f2e-4d1c-8b0a-9f8e7d6c5b4a" || notification.CreatedAt.IsZero() {
				t.Fatalf("notification = %#v", notification)
			}
		})
	}
}

// contractSchema compiles a shared schema from /contracts; pointer selects a $defs entry.
func contractSchema(t *testing.T, file, pointer string) *jsonschema.Schema {
	t.Helper()
	compiler := jsonschema.NewCompiler()
	compiler.AssertFormat()
	schema, err := compiler.Compile(filepath.Join("..", "..", "..", "..", "contracts", filepath.FromSlash(file)) + pointer)
	if err != nil {
		t.Fatalf("compile %s%s: %v", file, pointer, err)
	}
	return schema
}

func assertContract(t *testing.T, schema *jsonschema.Schema, body string) {
	t.Helper()
	value, err := jsonschema.UnmarshalJSON(bytes.NewReader([]byte(body)))
	if err != nil {
		t.Fatalf("parse %s: %v", body, err)
	}
	if err := schema.Validate(value); err != nil {
		t.Fatalf("%s does not match the contract: %v", body, err)
	}
}
