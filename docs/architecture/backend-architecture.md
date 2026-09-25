# Backend Architecture

## Purpose

Define server responsibilities and interaction style.

| Component | Responsibility | Inbound boundary |
| --- | --- | --- |
| API Gateway | Public routes, JWT check, CORS, correlation IDs, downstream error translation | Public HTTP |
| IAM | Accounts, password verification, JWT/access and refresh-token lifecycle | Gateway internal HTTP |
| Project | Workspaces, memberships, project lifecycle, access context | Gateway and Issue internal HTTP |
| Issue | Issues, comments, history, epics, sprints, outbox | Gateway internal HTTP |
| Notification | Kafka consumer and recipient notification projection | Kafka and Gateway internal HTTP |

Request-time access checks use HTTP: Issue asks Project for membership and project status, and Project asks IAM for member emails. Cross-service notification propagation uses `issue.events.v1`, not a distributed transaction.

## Observability

`x-correlation-id` keys every request log line and error response. Each service also exports OpenTelemetry traces when `OTEL_EXPORTER_OTLP_ENDPOINT` is set ([ADR 0006](../decisions/0006-distributed-tracing.md)):

- W3C `traceparent` travels on internal HTTP requests and as a header of `issue.events.v1` records.
- Each outbox row keeps the trace context of the request that wrote it, and the publisher sends the record under that context. One Issue command is therefore one trace: Gateway → Issue → Project → Kafka → Notification → Project.
- Every HTTP server span carries the request's correlation ID as the attribute `app.correlation_id`; Notification's consumer span carries the event ID, which is the correlation ID it sends to Project.
- Spans never contain credentials, tokens, `x-internal-service-secret`, or request and response bodies.

Compose runs Jaeger all-in-one; its UI is `http://localhost:16686`.
