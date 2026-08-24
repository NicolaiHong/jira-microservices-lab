# Environment Variables

## Purpose

Runtime configuration from Compose and service examples. Never commit actual secrets.

| Variable | Used by | Meaning |
| --- | --- | --- |
| `INTERNAL_SERVICE_SECRET` | Gateway and downstream services | Required shared credential for internal HTTP endpoints |
| `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE` | IAM and gateway | Access-token issuance and verification settings |
| `DATABASE_URL` | IAM, Project, Issue | Service-owned PostgreSQL connection |
| `REDIS_URL` | Gateway, Notification | Rate limiting / notification projection connection |
| `KAFKA_BROKERS`, `ISSUE_EVENTS_TOPIC` | Issue, Notification | Event transport configuration |
| `HTTP_CLIENT_TIMEOUT_MS` | Gateway, Issue, Notification | Synchronous downstream timeout |
| `PROJECT_SERVICE_URL` | Issue, Notification | Project Service base URL for internal access-context checks |
| `CORS_ALLOWED_ORIGINS` | Gateway | Permitted web-client origins |
| `NEXT_PUBLIC_API_GATEWAY_URL` | Web client | Browser gateway base URL |
