package consumer

import (
	"context"
	"strconv"

	"github.com/segmentio/kafka-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("notification-service/consumer")

// headerCarrier adapts kafka-go record headers to propagation.TextMapCarrier,
// so the W3C propagator reads the traceparent that Issue Service's producer
// wrote into the record (ADR 0006).
type headerCarrier struct{ headers *[]kafka.Header }

func (c headerCarrier) Get(key string) string {
	for _, header := range *c.headers {
		if header.Key == key {
			return string(header.Value)
		}
	}
	return ""
}

func (c headerCarrier) Set(key, value string) {
	for i, header := range *c.headers {
		if header.Key == key {
			(*c.headers)[i].Value = []byte(value)
			return
		}
	}
	*c.headers = append(*c.headers, kafka.Header{Key: key, Value: []byte(value)})
}

func (c headerCarrier) Keys() []string {
	keys := make([]string, 0, len(*c.headers))
	for _, header := range *c.headers {
		keys = append(keys, header.Key)
	}
	return keys
}

// process runs one processing attempt in a consumer span that continues the
// producer's trace, so the Project access checks join the Issue request's trace.
func (c *IssueEventConsumer) process(ctx context.Context, message kafka.Message) error {
	ctx = otel.GetTextMapPropagator().Extract(ctx, headerCarrier{headers: &message.Headers})
	ctx, span := tracer.Start(ctx, "process "+message.Topic,
		trace.WithSpanKind(trace.SpanKindConsumer),
		trace.WithAttributes(
			attribute.String("messaging.system", "kafka"),
			attribute.String("messaging.operation.type", "process"),
			attribute.String("messaging.destination.name", message.Topic),
			attribute.String("messaging.destination.partition.id", strconv.Itoa(message.Partition)),
			attribute.Int64("messaging.kafka.offset", message.Offset),
		))
	defer span.End()

	err := c.handle(ctx, message.Value)
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
	}
	return err
}
