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
| `NEXT_PUBLIC_API_GATEWAY_URL` | Web client | Browser gateway base URL |
