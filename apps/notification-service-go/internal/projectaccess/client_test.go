package projectaccess

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

const (
	testProjectID   = "11111111-1111-4111-8111-111111111111"
	testWorkspaceID = "22222222-2222-4222-8222-222222222222"
	testUserID      = "33333333-3333-4333-8333-333333333333"
)

func TestClientSendsApprovedProjectAccessRequestAndAcceptsArchivedMember(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Fatalf("method = %s, want GET", r.Method)
		}
		if r.URL.Path != "/internal/projects/"+testProjectID+"/access-context" {
			t.Fatalf("path = %s", r.URL.Path)
		}
		if r.URL.RawQuery != "" {
			t.Fatalf("unexpected query %q", r.URL.RawQuery)
		}
		if got := r.Header.Get("x-authenticated-user-id"); got != testUserID {
			t.Fatalf("x-authenticated-user-id = %q", got)
		}
		if got := r.Header.Get("x-internal-service-secret"); got != "test-internal-secret" {
			t.Fatalf("x-internal-service-secret = %q", got)
		}
		if got := r.Header.Get("x-correlation-id"); got != "event-123" {
			t.Fatalf("x-correlation-id = %q", got)
		}
		if got := r.Header.Get("Authorization"); got != "" {
			t.Fatalf("unexpected Authorization header %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"projectId":"` + testProjectID + `","workspaceId":"` + testWorkspaceID + `","projectKey":"ABC","projectStatus":"ARCHIVED","membershipRole":"MEMBER"}`))
	}))
	defer server.Close()

	client, err := NewClient(server.URL, "test-internal-secret", time.Second)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}

	decision, err := client.CheckAccess(context.Background(), testProjectID, testUserID, "event-123")
	if err != nil {
		t.Fatalf("CheckAccess() error = %v", err)
	}
	if decision != Eligible {
		t.Fatalf("decision = %v, want Eligible", decision)
	}
}

func TestClientOnlySkipsDocumentedProjectNotFound(t *testing.T) {
	tests := []struct {
		name         string
		status       int
		body         string
		wantDecision Decision
		wantError    bool
	}{
		{
			name:         "documented project not found",
			status:       http.StatusNotFound,
			body:         `{"code":"PROJECT_NOT_FOUND"}`,
			wantDecision: NotEligible,
		},
		{
			name:      "unexpected 404 code",
			status:    http.StatusNotFound,
			body:      `{"code":"WORKSPACE_NOT_FOUND"}`,
			wantError: true,
		},
		{
			name:      "internal authentication rejected",
			status:    http.StatusUnauthorized,
			body:      `{"code":"INTERNAL_SERVICE_AUTH_REQUIRED"}`,
			wantError: true,
		},
		{
			name:      "project dependency failure",
			status:    http.StatusServiceUnavailable,
			body:      `{"code":"INTERNAL_ERROR"}`,
			wantError: true,
		},
		{
			name:      "malformed success response",
			status:    http.StatusOK,
			body:      `{"projectId":"` + testProjectID + `"}`,
			wantError: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(test.status)
				_, _ = w.Write([]byte(test.body))
			}))
			defer server.Close()

			client, err := NewClient(server.URL, "test-internal-secret", time.Second)
			if err != nil {
				t.Fatalf("NewClient() error = %v", err)
			}
			decision, err := client.CheckAccess(context.Background(), testProjectID, testUserID, "event-123")
			if test.wantError {
				if err == nil {
					t.Fatal("CheckAccess() error = nil, want error")
				}
				return
			}
			if err != nil {
				t.Fatalf("CheckAccess() error = %v", err)
			}
			if decision != test.wantDecision {
				t.Fatalf("decision = %v, want %v", decision, test.wantDecision)
			}
		})
	}
}

func TestClientFailsOnProjectTimeout(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-r.Context().Done():
			return
		case <-time.After(100 * time.Millisecond):
			w.WriteHeader(http.StatusOK)
		}
	}))
	defer server.Close()

	client, err := NewClient(server.URL, "test-internal-secret", 10*time.Millisecond)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	_, err = client.CheckAccess(context.Background(), testProjectID, testUserID, "event-123")
	if err == nil {
		t.Fatal("CheckAccess() error = nil, want timeout error")
	}
}

func TestNewClientRejectsInvalidConfiguration(t *testing.T) {
	tests := []struct {
		name    string
		url     string
		secret  string
		timeout time.Duration
	}{
		{name: "missing URL", secret: "secret", timeout: time.Second},
		{name: "missing secret", url: "http://project-service:8082", timeout: time.Second},
		{name: "non-positive timeout", url: "http://project-service:8082", secret: "secret"},
		{name: "credentials in URL", url: "http://user:pass@project-service:8082", secret: "secret", timeout: time.Second},
		{name: "path in URL", url: "http://project-service:8082/api", secret: "secret", timeout: time.Second},
		{name: "unsupported scheme", url: "ftp://project-service:8082", secret: "secret", timeout: time.Second},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if _, err := NewClient(test.url, test.secret, test.timeout); err == nil {
				t.Fatal("NewClient() error = nil, want configuration error")
			}
		})
	}
}

func TestClientRejectsMalformedJSONAndMismatchedProjectID(t *testing.T) {
	tests := []string{
		`not-json`,
		`{"projectId":"other","workspaceId":"` + testWorkspaceID + `","projectKey":"ABC","projectStatus":"ACTIVE","membershipRole":"OWNER"}`,
		`{"projectId":"` + testProjectID + `","workspaceId":"` + testWorkspaceID + `","projectKey":"ABC","projectStatus":"ACTIVE","membershipRole":"OWNER"} {}`,
	}
	for _, body := range tests {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(body))
		}))
		client, err := NewClient(server.URL, "test-internal-secret", time.Second)
		if err != nil {
			server.Close()
			t.Fatalf("NewClient() error = %v", err)
		}
		_, err = client.CheckAccess(context.Background(), testProjectID, testUserID, "event-123")
		server.Close()
		if err == nil {
			t.Fatalf("CheckAccess(%q) error = nil, want malformed response error", body)
		}
	}
}

func TestClientDoesNotFollowRedirects(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Location", "http://example.invalid/access")
		w.WriteHeader(http.StatusTemporaryRedirect)
	}))
	defer server.Close()

	client, err := NewClient(server.URL, "test-internal-secret", time.Second)
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	_, err = client.CheckAccess(context.Background(), testProjectID, testUserID, "event-123")
	if err == nil {
		t.Fatal("CheckAccess() error = nil, want redirect error")
	}
}
