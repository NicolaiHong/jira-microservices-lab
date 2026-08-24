# Notifications Feature

## Purpose

Event-derived user notification projection.

## Related Requirements

NOTIF-001.

## Related Business Flows

[Notification](../flows/notification.md).

## Responsibilities

Issue writes historical recipient IDs in events; Notification revalidates each candidate's current Project access immediately before storing projections; Gateway enforces caller context at API edge.

## UI

Header notification bell/list.

## State

Kafka events and Redis notification hashes/indexes; React Query polling cache.

## API Usage

See [notifications API](../api/notifications.md).

## Validation

Event schema version 1 plus required IDs; notification route ID is nonblank.

## Authorization

Recipient owns their notification rows.

## Error Handling

Bad events are dead-lettered when possible. A documented Project `404` skips only that recipient; a Project timeout, transport/config/auth failure, malformed `200`, unexpected `4xx`, or `5xx` retries the record without Redis writes. Redis failures likewise retry without committing offset.

## Important Components / Modules

Issue outbox publisher; Go consumer/store/handler; client notification hooks.

## Tests

Consumer tests cover recipient access, all-or-nothing Redis projection, deterministic IDs, and offset/DLQ safety.

## Known Limitations

Polling only, 90-day retention, no exactly-once guarantee. Project Service availability now affects asynchronous notification projection and can increase Kafka lag. The accepted access-check-to-Redis-write TOCTOU cannot prevent an access change in that small interval.

## Open Questions

Notification preferences and recipient policy beyond current event payload are unspecified.
