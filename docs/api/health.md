# Health API

## Purpose

Operational readiness endpoints.

| Method/path | Purpose |
| --- | --- |
| `GET /health` | Gateway health or an individual internal service health response |
| `GET /health/services` | Gateway aggregation of configured downstream health checks |
| `GET /api/protected/profile-test` | Authenticated diagnostic endpoint returning JWT identity; not a product feature |

The gateway health endpoint is unauthenticated. Use it as the first local diagnostic, then inspect component `/health` paths. `GET /health/services` reports a service as `degraded` whenever that service's own `status` is not `ok`.

## Issue Service health

Issue Service `/health` checks `issue_db` and the outbox publisher's Kafka connection and adds an `outbox` object:

| Field | Meaning |
| --- | --- |
| `pending` | Unpublished events that still have retry attempts left |
| `abandoned` | Unpublished events that exhausted 20 attempts |
| `oldestPendingSeconds` | Age of the oldest pending event, or `null` |

`status` is `degraded` when the database query fails, the publisher is not connected to Kafka, any event is abandoned, or the oldest pending event is at least 300 seconds old.

An abandoned event is requeued manually after the broker problem is fixed:

```sql
UPDATE outbox_events
SET publish_attempts = 0, next_attempt_at = NOW()
WHERE published_at IS NULL AND publish_attempts >= 20;
```
