package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/example/jira-like-polyglot-microservices/notification-service/internal/api"
	"github.com/example/jira-like-polyglot-microservices/notification-service/internal/consumer"
	"github.com/example/jira-like-polyglot-microservices/notification-service/internal/projectaccess"
	"github.com/example/jira-like-polyglot-microservices/notification-service/internal/store"
)

func main() {
	redisStore, err := store.NewRedisStore(env("REDIS_URL", "redis://localhost:6379"))
	if err != nil {
		log.Fatal(err)
	}
	defer redisStore.Close()

	internalServiceSecret := env("INTERNAL_SERVICE_SECRET", "")
	if internalServiceSecret == "" {
		log.Fatal("INTERNAL_SERVICE_SECRET is required")
	}
	httpClientTimeout, err := millisecondsDuration(
		"HTTP_CLIENT_TIMEOUT_MS",
		env("HTTP_CLIENT_TIMEOUT_MS", "3000"),
	)
	if err != nil {
		log.Fatal(err)
	}
	projectAccessClient, err := projectaccess.NewClient(
		env("PROJECT_SERVICE_URL", ""),
		internalServiceSecret,
		httpClientTimeout,
	)
	if err != nil {
		log.Fatal(err)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	eventConsumer := consumer.NewIssueEventConsumer(
		strings.Split(env("KAFKA_BROKERS", "localhost:9092"), ","),
		env("ISSUE_EVENTS_TOPIC", "issue.events.v1"),
		redisStore,
		projectAccessClient,
	)
	consumerDone := make(chan struct{})
	go func() {
		eventConsumer.Run(ctx)
		close(consumerDone)
	}()

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
	if err := server.Shutdown(shutdownContext); err != nil {
		log.Printf("notification-service shutdown failed: %v", err)
	}
	select {
	case <-consumerDone:
	case <-shutdownContext.Done():
		log.Printf("notification consumer did not stop before shutdown deadline")
	}
	if err := eventConsumer.Close(); err != nil {
		log.Printf("notification consumer shutdown failed: %v", err)
	}
}

func env(name string, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}

func millisecondsDuration(name, value string) (time.Duration, error) {
	milliseconds, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || milliseconds <= 0 {
		return 0, fmt.Errorf("%s must be a positive integer", name)
	}
	return time.Duration(milliseconds) * time.Millisecond, nil
}
