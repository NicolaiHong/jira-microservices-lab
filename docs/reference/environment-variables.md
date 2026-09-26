# Environment Variables

## Purpose

Runtime configuration from Compose and service examples. Never commit actual secrets.

| Variable | Used by | Meaning |
| --- | --- | --- |
| `INTERNAL_SERVICE_SECRET` | Gateway and downstream services | Required shared credential for internal HTTP endpoints |
| `JWT_SECRET` | IAM and gateway | Required HS256 signing secret, at least 32 bytes; both services refuse to start without it |
| `JWT_ISSUER`, `JWT_AUDIENCE` | IAM and gateway | Access-token issuer and audience claims |
| `DATABASE_URL` | IAM, Project, Issue | Service-owned PostgreSQL connection |
| `REDIS_URL` | Gateway, Notification | Rate limiting / notification projection connection |
| `KAFKA_BROKERS`, `ISSUE_EVENTS_TOPIC` | Issue, Notification | Event transport configuration |
| `HTTP_CLIENT_TIMEOUT_MS` | Gateway, Project, Issue, Notification | Synchronous downstream timeout |
| `PROJECT_SERVICE_URL` | Issue, Notification | Project Service base URL for internal access-context checks |
| `IAM_SERVICE_URL` | Gateway, Project | IAM base URL; Project uses it for member identity lookup ([ADR 0003](../decisions/0003-workspace-member-identity-lookup.md)) |
| `CORS_ALLOWED_ORIGINS` | Gateway | Permitted web-client origins |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Gateway, IAM, Project, Issue, Notification | OTLP/HTTP base URL for traces; each service appends `/v1/traces`. Unset or empty turns tracing off. Compose defaults to `http://jaeger:4318`; an empty value in `.env` turns it off ([ADR 0006](../decisions/0006-distributed-tracing.md)) |
| `OTEL_SERVICE_NAME` | Gateway, IAM, Project, Issue, Notification | Service name on exported spans. Compose sets `api-gateway`, `iam-service`, `project-service`, `issue-service` and `notification-service`; IAM falls back to `iam-service` |
| `NEXT_PUBLIC_API_GATEWAY_URL` | Web client (build arg) | Gateway base URL the browser calls. Next inlines it into the bundle at `next build`, so Compose passes it as a build arg, not a runtime variable, and a change requires rebuilding the image. It is a host URL because the browser runs on the host. The default is `http://localhost:${API_GATEWAY_PORT:-3000}`. Never put a secret in a `NEXT_PUBLIC_*` variable |
