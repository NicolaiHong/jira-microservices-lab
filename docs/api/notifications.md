# Notifications API

## Purpose

Recipient-scoped notification projection routes.

| Method/path | Authorization | Request | Success | Validation/errors | Requirement |
| --- | --- | --- | --- | --- | --- |
| `GET /api/notifications` | Authenticated recipient | — | `200 { items }` | notification service unavailable | NOTIF-001 |
| `PATCH /api/notifications/{notificationId}/read` | Authenticated recipient | — | `204` | unknown own ID 404 | NOTIF-001 |
| `POST /api/notifications/read-all` | Authenticated recipient | — | `204` | service unavailable | NOTIF-001 |

List returns at most 100 most-recent records from Redis. Notification data is user-scoped and expires after 90 days.
