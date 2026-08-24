# Notifications Feature

## Purpose

Event-derived user notification projection.

## Related Requirements

NOTIF-001.

## Related Business Flows

[Notification](../flows/notification.md).

## Responsibilities

Issue writes recipient IDs in events; Notification consumes and stores projections; Gateway enforces caller context at API edge.

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

Bad events are dead-lettered when possible; Redis failures are retried by not committing offset.

## Important Components / Modules

Issue outbox publisher; Go consumer/store/handler; client notification hooks.

## Tests

Redis store tests cover persistence behaviour.

## Known Limitations

Polling only, 90-day retention, no exactly-once guarantee.

## Open Questions

Notification preferences and recipient policy beyond current event payload are unspecified.
