package api

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/example/jira-like-polyglot-microservices/notification-service/internal/domain"
	"github.com/example/jira-like-polyglot-microservices/notification-service/internal/store"
	"github.com/google/uuid"
	"github.com/santhosh-tekuri/jsonschema/v6"
)

const contractSecret = "contract-test-secret"

func TestFailuresUseTheErrorEnvelope(t *testing.T) {
	// Nothing listens on port 1, so every store call fails fast.
	unreachable, err := store.NewRedisStore("redis://127.0.0.1:1/0?max_retries=-1&dial_timeout=200ms")
	if err != nil {
		t.Fatal(err)
	}
	defer unreachable.Close()
	errorSchema := contractSchema(t, "http/error.schema.json", "")
	tests := []struct {
		name, secret, userID, wantCode string
		wantStatus                     int
	}{
		{name: "missing internal secret", wantStatus: http.StatusUnauthorized, wantCode: "INTERNAL_SERVICE_AUTH_REQUIRED"},
		{name: "missing user context", secret: contractSecret, wantStatus: http.StatusUnauthorized, wantCode: "AUTH_CONTEXT_REQUIRED"},
		{name: "store failure", secret: contractSecret, userID: uuid.NewString(), wantStatus: http.StatusInternalServerError, wantCode: "INTERNAL_ERROR"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := serve(NewHandler(unreachable, contractSecret), http.MethodGet, "/internal/notifications", test.secret, test.userID)
			assertContract(t, errorSchema, response.Body.String())
			if response.Code != test.wantStatus || !bytes.Contains(response.Body.Bytes(), []byte(`"code":"`+test.wantCode+`"`)) {
				t.Fatalf("response = %d %s", response.Code, response.Body.String())
			}
		})
	}
}

func TestNotificationRoutesMatchTheContractWithRedis(t *testing.T) {
	url := os.Getenv("NOTIFICATION_TEST_REDIS_URL")
	if url == "" {
		t.Skip("NOTIFICATION_TEST_REDIS_URL is required for real Redis integration")
	}
	redisStore, err := store.NewRedisStore(url)
	if err != nil {
		t.Fatal(err)
	}
	defer redisStore.Close()
	userID := uuid.NewString()
	err = redisStore.SaveEventNotifications(context.Background(), []domain.Notification{{
		ID: store.DeterministicID(uuid.NewString(), userID), UserID: userID, EventID: uuid.NewString(),
		Type: "issue.transitioned", Title: "Issue status changed", Body: "LRN-1 moved to DONE",
		IssueID: uuid.NewString(), ProjectID: uuid.NewString(), CreatedAt: time.Now().UTC(),
	}})
	if err != nil {
		t.Fatal(err)
	}
	handler := NewHandler(redisStore, contractSecret)

	list := serve(handler, http.MethodGet, "/internal/notifications", contractSecret, userID)
	if list.Code != http.StatusOK || !bytes.Contains(list.Body.Bytes(), []byte(userID)) {
		t.Fatalf("list = %d %s", list.Code, list.Body.String())
	}
	assertContract(t, contractSchema(t, "http/notification.schema.json", "#/$defs/notificationList"), list.Body.String())

	missing := serve(handler, http.MethodPatch, "/internal/notifications/unknown/read", contractSecret, userID)
	if missing.Code != http.StatusNotFound {
		t.Fatalf("mark unknown read = %d %s", missing.Code, missing.Body.String())
	}
	assertContract(t, contractSchema(t, "http/error.schema.json", ""), missing.Body.String())
}

func serve(handler *Handler, method, path, secret, userID string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, nil)
	if secret != "" {
		request.Header.Set("x-internal-service-secret", secret)
	}
	if userID != "" {
		request.Header.Set("x-authenticated-user-id", userID)
	}
	response := httptest.NewRecorder()
	handler.Routes().ServeHTTP(response, request)
	return response
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
