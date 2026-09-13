package api

import (
	"github.com/google/uuid"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCorrelationIDGeneratedAndPropagated(t *testing.T) {
	for _, supplied := range []string{"", "caller-correlation"} {
		r := httptest.NewRequest(http.MethodGet, "/health", nil)
		r.Header.Set("x-correlation-id", supplied)
		w := httptest.NewRecorder()
		correlationAndLogging(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if w.Header().Get("x-correlation-id") != r.Header.Get("x-correlation-id") {
				t.Fatal("request and response differ")
			}
		})).ServeHTTP(w, r)
		actual := w.Header().Get("x-correlation-id")
		if supplied != "" && actual != supplied {
			t.Fatal("caller correlation changed")
		}
		if supplied == "" {
			id, err := uuid.Parse(actual)
			if err != nil || id.Version() != 4 {
				t.Fatalf("expected UUID v4, got %q", actual)
			}
		}
	}
}
