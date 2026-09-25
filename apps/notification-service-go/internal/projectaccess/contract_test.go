package projectaccess

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

func TestClientReadsContractValidAccessContextAndNotFoundEnvelope(t *testing.T) {
	tests := []struct {
		name         string
		status       int
		body         string
		file         string
		pointer      string
		wantDecision Decision
	}{
		{
			name:   "current member",
			status: http.StatusOK,
			body:   `{"projectId":"` + testProjectID + `","workspaceId":"` + testWorkspaceID + `","projectKey":"LRN","projectStatus":"ACTIVE","membershipRole":"OWNER"}`,
			file:   "http/project.schema.json", pointer: "#/$defs/accessContext",
			wantDecision: Eligible,
		},
		{
			name:         "removed member",
			status:       http.StatusNotFound,
			body:         `{"code":"PROJECT_NOT_FOUND","message":"Project was not found","correlationId":"event-123","details":{}}`,
			file:         "http/error.schema.json",
			wantDecision: NotEligible,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assertContract(t, contractSchema(t, test.file, test.pointer), test.body)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(test.status)
				_, _ = w.Write([]byte(test.body))
			}))
			defer server.Close()
			client, err := NewClient(server.URL, "test-internal-secret", time.Second)
			if err != nil {
				t.Fatalf("NewClient() error = %v", err)
			}

			decision, err := client.CheckAccess(context.Background(), testProjectID, testUserID, "event-123")
			if err != nil || decision != test.wantDecision {
				t.Fatalf("CheckAccess() = %v, %v; want %v", decision, err, test.wantDecision)
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
