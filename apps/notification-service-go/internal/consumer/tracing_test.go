package consumer

import (
	"context"
	"testing"

	"github.com/example/jira-like-polyglot-microservices/notification-service/internal/projectaccess"
	"github.com/segmentio/kafka-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
)

const producerTraceparent = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"

func TestHeaderCarrierInjectsAndExtractsTraceparent(t *testing.T) {
	propagator := propagation.TraceContext{}
	spanContext := propagator.Extract(context.Background(), propagation.MapCarrier{"traceparent": producerTraceparent})
	headers := []kafka.Header{
		{Key: "traceparent", Value: []byte("00-stale")},
		{Key: "failure-reason", Value: []byte("kept")},
	}

	propagator.Inject(spanContext, headerCarrier{headers: &headers})

	if len(headers) != 2 || string(headers[0].Value) != producerTraceparent || string(headers[1].Value) != "kept" {
		t.Fatalf("headers after inject = %q", headers)
	}
	got := trace.SpanContextFromContext(propagator.Extract(context.Background(), headerCarrier{headers: &headers}))
	if !got.Equal(trace.SpanContextFromContext(spanContext)) {
		t.Fatalf("extracted span context = %v, want %v", got, trace.SpanContextFromContext(spanContext))
	}
}

type traceRecordingChecker struct{ traceIDs []trace.TraceID }

func (c *traceRecordingChecker) CheckAccess(ctx context.Context, _, _, _ string) (projectaccess.Decision, error) {
	c.traceIDs = append(c.traceIDs, trace.SpanContextFromContext(ctx).TraceID())
	return projectaccess.Eligible, nil
}

func TestProcessContinuesTheProducerTrace(t *testing.T) {
	recorder := tracetest.NewSpanRecorder()
	provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
	otel.SetTracerProvider(provider)
	otel.SetTextMapPropagator(propagation.TraceContext{})
	t.Cleanup(func() {
		otel.SetTracerProvider(noop.NewTracerProvider())
		otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator())
	})
	access := &traceRecordingChecker{}
	consumer := newIssueEventConsumer(nil, nil, &fakeNotificationStore{}, access, testRetryPolicy())

	err := consumer.process(context.Background(), kafka.Message{
		Topic:   "issue.events.v1",
		Value:   issueEvent(t, "issue.transitioned", []any{"recipient-a"}, "actor-a"),
		Headers: []kafka.Header{{Key: "traceparent", Value: []byte(producerTraceparent)}},
	})
	if err != nil {
		t.Fatalf("process() error = %v", err)
	}

	spans := recorder.Ended()
	if len(spans) != 1 {
		t.Fatalf("ended spans = %d, want 1", len(spans))
	}
	span := spans[0]
	if span.Parent().TraceID().String() != "0af7651916cd43dd8448eb211c80319c" ||
		span.Parent().SpanID().String() != "b7ad6b7169203331" ||
		span.SpanKind() != trace.SpanKindConsumer {
		t.Fatalf("span parent = %v, kind = %v", span.Parent(), span.SpanKind())
	}
	if len(access.traceIDs) != 1 || access.traceIDs[0] != span.Parent().TraceID() {
		t.Fatalf("project access trace IDs = %v", access.traceIDs)
	}
	correlation := attribute.String("app.correlation_id", consumerTestEventID)
	for _, attr := range span.Attributes() {
		if attr == correlation {
			return
		}
	}
	t.Fatalf("span attributes = %v, want %v", span.Attributes(), correlation)
}
