-- W3C trace context of the request that wrote the event, e.g.
-- {"traceparent": "00-..."}. The publisher restores it so the Kafka send joins
-- that request's trace (ADR 0006). NULL when tracing is off.
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS trace_context JSONB;
