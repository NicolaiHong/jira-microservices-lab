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
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

func main() {
	shutdownTracing, err := setupTracing(context.Background())
	if err != nil {
		log.Fatal(err)
	}
	defer shutdownTracing()

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

// setupTracing exports spans over OTLP/HTTP when OTEL_EXPORTER_OTLP_ENDPOINT is
// set (ADR 0006). The exporter and the resource read the endpoint and
// OTEL_SERVICE_NAME from the environment. Without an endpoint tracing stays off.
func setupTracing(ctx context.Context) (func(), error) {
	if env("OTEL_EXPORTER_OTLP_ENDPOINT", "") == "" {
		return func() {}, nil
	}
	exporter, err := otlptracehttp.New(ctx)
	if err != nil {
		return nil, fmt.Errorf("create OTLP trace exporter: %w", err)
	}
	provider := sdktrace.NewTracerProvider(sdktrace.WithBatcher(exporter))
	otel.SetTracerProvider(provider)
	otel.SetTextMapPropagator(propagation.TraceContext{})
	return func() {
		shutdownContext, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := provider.Shutdown(shutdownContext); err != nil {
			log.Printf("tracing shutdown failed: %v", err)
		}
	}, nil
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
