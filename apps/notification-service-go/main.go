package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/example/jira-like-polyglot-microservices/notification-service/internal/api"
	"github.com/example/jira-like-polyglot-microservices/notification-service/internal/consumer"
	"github.com/example/jira-like-polyglot-microservices/notification-service/internal/store"
)

func main() {
	redisStore, err := store.NewRedisStore(env("REDIS_URL", "redis://localhost:6379"))
	if err != nil {
		log.Fatal(err)
	}
	defer redisStore.Close()

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	eventConsumer := consumer.NewIssueEventConsumer(
		strings.Split(env("KAFKA_BROKERS", "localhost:9092"), ","),
		env("ISSUE_EVENTS_TOPIC", "issue.events.v1"),
		redisStore,
	)
	go eventConsumer.Run(ctx)

	internalServiceSecret := env("INTERNAL_SERVICE_SECRET", "")
	if internalServiceSecret == "" {
		log.Fatal("INTERNAL_SERVICE_SECRET is required")
	}

	server := &http.Server{
		Addr:              "0.0.0.0:" + env("PORT", "8084"),
		Handler:           api.NewHandler(redisStore, internalServiceSecret).Routes(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		log.Printf("notification-service listening on %s", server.Addr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	<-ctx.Done()
	shutdownContext, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	_ = eventConsumer.Close()
	if err := server.Shutdown(shutdownContext); err != nil {
		log.Printf("notification-service shutdown failed: %v", err)
	}
}

func env(name string, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}
