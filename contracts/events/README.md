# Event Contracts

Issue Service publishes version 1 envelopes to `issue.events.v1` through its transactional Outbox. Notification Service consumes the topic with consumer group `notification-service-v1`.

Delivery is at-least-once, and every consumer must deduplicate by `eventId`. Events of one Issue are published in `aggregateVersion` order and share the Kafka key `aggregateId`, so they reach consumers in that order; there is no ordering across Issues ([ADR 0004](../../docs/decisions/0004-outbox-claim-and-per-aggregate-ordering.md)). New incompatible shapes require a new schema version and topic; additive payload fields remain backward compatible.

- [`issue-event-v1.schema.json`](issue-event-v1.schema.json) is the transport contract.
- Current event types are `issue.created`, `issue.updated`, `issue.assigned`, `issue.transitioned`, and `issue.commented`.
- `payload.recipientUserIds` carries historical candidate recipients. Immediately before Redis projection, Notification Service removes the actor, deduplicates candidates, and verifies each candidate's current Project access. A removed member therefore does not receive a new notification, while the historical Issue reporter/assignee identity remains unchanged.
