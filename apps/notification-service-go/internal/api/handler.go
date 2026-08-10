package api

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/example/jira-like-polyglot-microservices/notification-service/internal/store"
)

type Handler struct {
	store *store.RedisStore
}

func NewHandler(store *store.RedisStore) *Handler { return &Handler{store: store} }

func (h *Handler) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", h.health)
	mux.HandleFunc("GET /internal/notifications", h.list)
	mux.HandleFunc("PATCH /internal/notifications/{notificationId}/read", h.markRead)
	mux.HandleFunc("POST /internal/notifications/read-all", h.markAllRead)
	return correlationAndLogging(mux)
}

func (h *Handler) health(w http.ResponseWriter, r *http.Request) {
	dependencies := map[string]string{"redis": "ok", "kafka": "consumer_managed"}
	status := http.StatusOK
	if err := h.store.Ping(r.Context()); err != nil {
		dependencies["redis"] = "unavailable"
		status = http.StatusServiceUnavailable
	}
	writeJSON(w, status, map[string]any{
		"status":  map[bool]string{true: "ok", false: "degraded"}[status == http.StatusOK],
		"service": "notification-service", "version": "0.2.0",
		"timestamp": time.Now().UTC(), "dependencies": dependencies,
	})
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := authenticatedUserID(w, r)
	if !ok {
		return
	}
	items, err := h.store.List(r.Context(), userID, 100)
	if err != nil {
		internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) markRead(w http.ResponseWriter, r *http.Request) {
	userID, ok := authenticatedUserID(w, r)
	if !ok {
		return
	}
	id := strings.TrimSpace(r.PathValue("notificationId"))
	if id == "" {
		writeError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "notificationId is required")
		return
	}
	if err := h.store.MarkRead(r.Context(), userID, id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, r, http.StatusNotFound, "NOTIFICATION_NOT_FOUND", "Notification was not found")
			return
		}
		internalError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) markAllRead(w http.ResponseWriter, r *http.Request) {
	userID, ok := authenticatedUserID(w, r)
	if !ok {
		return
	}
	if err := h.store.MarkAllRead(r.Context(), userID); err != nil {
		internalError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func authenticatedUserID(w http.ResponseWriter, r *http.Request) (string, bool) {
	userID := strings.TrimSpace(r.Header.Get("x-authenticated-user-id"))
	if userID == "" {
		writeError(w, r, http.StatusUnauthorized, "AUTH_CONTEXT_REQUIRED", "Authenticated user context is required")
		return "", false
	}
	return userID, true
}

func correlationAndLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		correlationID := strings.TrimSpace(r.Header.Get("x-correlation-id"))
		if correlationID == "" {
			correlationID = strings.ReplaceAll(time.Now().UTC().Format("20060102150405.000000000"), ".", "")
			r.Header.Set("x-correlation-id", correlationID)
		}
		w.Header().Set("x-correlation-id", correlationID)
		next.ServeHTTP(w, r)
		log.Printf(`{"service":"notification-service","correlationId":%q,"method":%q,"path":%q,"durationMs":%d}`,
			correlationID, r.Method, r.URL.Path, time.Since(started).Milliseconds())
	})
}

func internalError(w http.ResponseWriter, r *http.Request, err error) {
	log.Printf("notification request failed: %v", err)
	writeError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
}

func writeError(w http.ResponseWriter, r *http.Request, status int, code, message string) {
	writeJSON(w, status, map[string]any{
		"code": code, "message": message, "details": map[string]any{},
		"correlationId": r.Header.Get("x-correlation-id"),
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Printf("encode response: %v", err)
	}
}
