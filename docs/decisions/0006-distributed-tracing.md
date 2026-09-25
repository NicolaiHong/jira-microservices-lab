# ADR 0006: Distributed Tracing

## Status

Accepted — reflected in the implementation.

## Context

One Issue command crosses Gateway, Issue, Project, Kafka, Notification and Project again. `x-correlation-id` ties together the log lines of one request, but it shows neither how long each hop takes nor which hop failed, and it stops at the outbox: Notification Service calls Project with the event ID as its correlation ID.

Tracing adds local infrastructure and a header that crosses both HTTP and Kafka, so it needs an ADR (dependency rule 7).

The Issue outbox publisher runs on a two-second poller outside the request that wrote the event ([ADR 0004](0004-outbox-claim-and-per-aggregate-ordering.md)). When it sends to Kafka, the request's context is gone, so the Kafka span can join the request's trace only if the context is stored with the outbox row.

## Decision

### Export

- Every service exports spans with OTLP over HTTP (`http/protobuf`) to `OTEL_EXPORTER_OTLP_ENDPOINT`, and `OTEL_SERVICE_NAME` names the service.
- Compose runs one Jaeger container, `jaegertracing/jaeger`, whose default configuration is all-in-one with in-memory storage. It receives OTLP on port 4318 inside the Compose network and publishes its UI on `http://localhost:16686`. There is no separate collector.
- Tracing is off when `OTEL_EXPORTER_OTLP_ENDPOINT` is unset or empty: Gateway, Issue and Notification start no SDK, Project registers no OpenTelemetry services, and IAM sets `management.tracing.enabled=false`. Unit tests and every CI job except `e2e-compose` run without Jaeger.
- Every span is sampled (parent-based always-on). IAM sets `management.tracing.sampling.probability=1.0`, because Spring Boot samples 10% by default.

### Propagation

- HTTP requests carry the W3C `traceparent` header (and `tracestate` when present). Instrumented clients inject it and instrumented servers continue it.
- Kafka records on `issue.events.v1` carry `traceparent` as a record header. The event envelope does not change: the header is transport metadata outside the JSON value and outside the schema, and a consumer that ignores headers keeps working. A dead-letter record copies the original headers, so it keeps the trace.
- Gateway and Issue Service propagate W3C trace context only, not W3C baggage. A caller therefore cannot push baggage through the public edge into downstream services, outbox rows or Kafka headers.

### Outbox trace context

- Migration `009_outbox_trace_context.sql` adds the nullable JSONB column `outbox_events.trace_context`. The transaction that writes an event stores the W3C carrier of the active context in it, for example `{"traceparent": "00-…-…-01"}`. The column is `NULL` when tracing is off and for rows written before the column existed.
- The publisher restores the stored context of each claimed row and sends the record under it. The kafkajs producer span becomes a child of the request's span and writes its own `traceparent` into the record. A row with `NULL` starts a new trace.
- The kafkajs instrumentation takes the parent of every producer span from the context that is active when `send` is called. The publisher therefore sends each claimed event with its own `producer.send`, all concurrently, and waits until every send has settled. A poll claims at most one event per Issue (ADR 0004), so per-Issue order is unchanged. If any send fails, every event of the batch records a failure, exactly as a failed batched send does; events that were delivered anyway are removed by `eventId` deduplication.

#### Parent or link

- **Parent (chosen).** The Kafka span continues the request's trace, so Jaeger shows Gateway → Issue → Project → Kafka → Notification → Project as one trace. The trace's duration then includes the outbox wait: at least one poll, up to about an hour under retry backoff, and an abandoned event never adds its asynchronous part. Jaeger can show a trace before the Kafka part arrives; reloading the trace shows the later spans.
- **Link (rejected).** A publish span in its own trace, with a span link to each request, is the OpenTelemetry messaging convention for batch sends and keeps one batched `send` per poll. Jaeger shows a link only as a reference to another trace, so following one Issue command means opening two traces, which defeats the purpose of this change.

### Correlation ID

`x-correlation-id` stays the key of logs and error responses and keeps its propagation. Each HTTP server span carries it as the attribute `app.correlation_id`, so a correlation ID from a log line or an error response finds its trace (Jaeger tag search `app.correlation_id=<id>`). Notification's consumer span carries the event ID in the same attribute, because that is the correlation ID it sends to Project.

### Instrumentation

| Service | Setup | Spans |
| --- | --- | --- |
| Gateway | `@opentelemetry/sdk-node`, started by `src/tracing.ts` before the application is imported | HTTP server (`http`, `fastify`), outgoing `fetch` (`undici`) |
| Issue | Same as Gateway | HTTP server, outgoing `fetch`, `pg` queries inside a request, kafkajs producer |
| IAM | Micrometer Tracing with the OpenTelemetry bridge and the OTLP exporter, as Maven dependencies; no Java agent | HTTP server |
| Project | `OpenTelemetry.Extensions.Hosting` with the AspNetCore, HttpClient and OTLP exporter packages, plus Npgsql's built-in `Npgsql` activity source | HTTP server, HttpClient to IAM, SQL commands |
| Notification | OpenTelemetry Go SDK; a `propagation.TextMapCarrier` over kafka-go record headers; an `otelhttp` transport on the Project client | Kafka record processing, HTTP client to Project; its own HTTP API is not traced |

- Gateway and Issue call other services with `fetch`, which `@opentelemetry/instrumentation-http` does not cover, so both also use `@opentelemetry/instrumentation-undici`.
- The `pg` instrumentation creates spans only under a parent span, so the outbox poller's queries do not start a trace every two seconds.
- The Node SDK enables OTLP metrics and logs exporters by default; both are switched off.
- Apart from Micrometer Tracing, which is Spring Boot 3.3's tracing API, every tracing dependency is published by the OpenTelemetry project.

### Sensitive data

No span, span event or attribute contains `Authorization`, `Cookie`, `Set-Cookie`, access or refresh tokens, `x-internal-service-secret`, request or response bodies, or passwords:

- HTTP spans record method, route, URL, status and `user-agent`. The only query strings are the issue list's filters and cursor. No instrumentation captures other headers by default, no service turns header capture on, and `app.correlation_id` is the only other header value recorded.
- Database spans record the SQL text as the code writes it, never bound parameter values. The `pg` instrumentation strips user and password from the connection string, and Npgsql omits the password unless `Persist Security Info` is set, which no connection string does.
- The kafkajs producer span records topic, key and partition, not the record value. The Notification consumer span records topic, partition, offset and event ID.
- `outbox_events.trace_context` holds only `traceparent` and `tracestate`.

Gateway continues a `traceparent` sent by its caller. Browsers cannot send one, because the Gateway's CORS policy allows only `content-type`, `authorization` and `x-correlation-id` request headers.

### Out of scope

Metrics, log shipping, custom sampling, production exporters and retention, and mTLS or authentication towards the trace backend.

## Alternatives

- An OpenTelemetry Collector in front of Jaeger. Rejected because Jaeger receives OTLP directly and a collector adds a container without a local benefit.
- The OpenTelemetry Java agent for IAM. Rejected because it downloads a jar at build or start time and instruments far more than IAM's HTTP endpoints; Spring Boot's Micrometer tracing needs only dependencies.
- Trace context inside the event envelope. Rejected because it changes a versioned contract that every consumer validates, while record headers already carry transport metadata.
- Replacing `x-correlation-id` with the trace ID. Rejected because logs, error bodies and clients rely on the correlation ID, and tracing can be off.
- A span link from a batch publish span. Rejected as described in [Parent or link](#parent-or-link).

## Consequences

- Traces exist only while the Jaeger container runs; there is no sampling, retention policy or access control, so the setup is for local development only.
- Each publisher poll sends one produce request per claimed event instead of one per batch.
- An asynchronous trace stays open until its Kafka part is processed, and its duration includes the outbox wait.
- OpenTelemetry Go is pinned to v1.35.0 and contrib v0.60.0, the last releases that support Go 1.22. A newer OpenTelemetry Go requires a newer Go toolchain for Notification Service.
- `@opentelemetry/instrumentation-fastify` is deprecated upstream in favour of `@fastify/otel`, which the Fastify project publishes. Moving to it touches only the two `src/tracing.ts` files and their `package.json`.
- IAM adds Spring Boot Actuator, which carries the tracing auto-configuration. `management.server.port=-1` keeps every actuator endpoint off HTTP.
