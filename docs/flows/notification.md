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
3. Notification consumer validates the envelope, normalizes and deduplicates candidate recipients, excludes the actor under the existing event semantics, and asks Project Service for each remaining recipient's current access context.
4. A documented `404 PROJECT_NOT_FOUND` means that recipient is skipped. A timeout, transport error, `5xx`, malformed success response, unexpected `4xx`, or internal authentication/configuration failure makes the Kafka record retryable.
5. Only after every required access check succeeds does the consumer write all eligible deterministic recipient records to Redis in one batched operation. Zero eligible recipients is a successful no-op.
6. Recipient reads and mark-read requests continue through the Gateway.

## Alternative Flows

### A1 — Kafka redelivery

The same event/recipient produces the same deterministic ID, so Redis write is idempotent.

## Failure / Error Flows

Publisher records failed attempts and retries up to its query limit; malformed/unsupported events go to a dead-letter topic when delivery succeeds. Redis and Project access errors prevent Kafka offset commit and are retried. The consumer never advances or commits a partition past a retryable failed record. After a successful DLQ write it can commit that record; a DLQ or commit failure leaves the offset uncommitted.

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

Notifications expire after 90 days. Exactly-once delivery is not guaranteed. Historical reporter and assignee identities in Issue records/events remain unchanged; removed members simply do not receive new notification projections. An archived Project member remains eligible for read notifications. The access-check-to-Redis-write interval is an accepted TOCTOU boundary.

## Acceptance Criteria

### AC-NOTIF-001

Given an issue event with a recipient, when Kafka delivers it once or more, then that recipient has at most one corresponding notification.

## Related Documentation

[notifications API](../api/notifications.md), [event contract](../../contracts/events/README.md).
