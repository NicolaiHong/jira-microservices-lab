# Health API

## Purpose

Operational readiness endpoints.

| Method/path | Purpose |
| --- | --- |
| `GET /health` | Gateway health or an individual internal service health response |
| `GET /health/services` | Gateway aggregation of configured downstream health checks |
| `GET /api/protected/profile-test` | Authenticated diagnostic endpoint returning JWT identity; not a product feature |

The gateway health endpoint is unauthenticated. Use it as the first local diagnostic, then inspect component `/health` paths.
