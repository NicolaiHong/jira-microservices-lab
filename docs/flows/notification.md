# Notification Flow

## Purpose

Deliver event-derived issue notifications to recipients without coupling Issue availability to Notification availability.

## Actors

- Issue actor
- Event recipient

## Preconditions

An Issue mutation commits an outbox event; Kafka and Notification service eventually run.

## Trigger

`issue.created`, `issue.updated`, `issue.assigned`, `issue.transitioned`, or `issue.commented` is published to `issue.events.v1`.

## Main Flow

1. Issue transaction writes its outbox event with recipient IDs excluding the actor.
2. Outbox publisher sends the version-1 envelope to Kafka and marks it published.
3. Notification consumer validates envelope, derives content, and stores deterministic recipient records in Redis.
4. Recipient's client polls Gateway; Gateway forwards user context to Notification Service.
5. Recipient marks one or all notifications read.

## Alternative Flows

### A1 — Kafka redelivery

The same event/recipient produces the same deterministic ID, so Redis write is idempotent.

## Failure / Error Flows

Publisher records failed attempts and retries up to its query limit; malformed/unsupported events go to a dead-letter topic when delivery succeeds. Redis errors prevent Kafka offset commit and are retried.

## Business Rules

[BR-NOTIF-001](../product/business-rules.md#br-notif-001--recipient-owned-event-derived-notifications).

## State Transitions

Notification `unread → read`; repeated mark-read is idempotent.

## Permissions

Only the authenticated recipient can list or change their own records.

## Data Affected

Issue outbox, Kafka topic, recipient notification/index hashes in Redis.

## API Dependencies

`GET /api/notifications`, `PATCH /api/notifications/{notificationId}/read`, `POST /api/notifications/read-all`.

## UI Entry Points

Header notification bell/list; query polls every five seconds.

## Validation

Consumer requires schema version 1, event ID, and aggregate ID. Read endpoint validates notification ID is nonempty.

## Edge Cases

Notifications expire after 90 days. Exactly-once delivery is not guaranteed.

## Acceptance Criteria

### AC-NOTIF-001

Given an issue event with a recipient, when Kafka delivers it once or more, then that recipient has at most one corresponding notification.

## Related Documentation

[notifications API](../api/notifications.md), [event contract](../../contracts/events/README.md).
