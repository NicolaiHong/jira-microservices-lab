# ADR 0004: Outbox Claim and Per-Aggregate Ordering

## Status

Accepted — reflected in the implementation.

## Context

Issue Service writes every Issue change and its `issue.events.v1` event in one local transaction (ADR 0001), and an in-process publisher sends pending outbox rows to Kafka. Several Issue Service replicas can run against the same `issue_db`. Without row claiming, two replicas read the same pending rows and publish them twice. Each event also backs off independently after a failed send, so a later event of an Issue could otherwise overtake an earlier one that is waiting to retry. Kafka keys every message by `aggregateId`, so a single partition preserves whatever order the publisher produces for an Issue.

Every event-emitting Issue write increments `issues.version` through a compare-and-swap update and stores the new value as `aggregate_version`: creation is version 1, and updates, assignments, transitions, and comments each add one. `aggregate_version` is therefore strictly increasing per Issue and is the ordering key.

## Decision

- **Claim by lease.** The publisher claims a batch with one statement: `UPDATE outbox_events SET next_attempt_at = NOW() + 30 s WHERE event_id IN (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING ...`. Concurrent claimers skip each other's locked rows, and the pushed-forward `next_attempt_at` hides a claimed row from later claims. The claiming transaction commits immediately; no transaction is held while Kafka is called. The 30-second lease exceeds a normal Kafka send.
- **Per-aggregate gate.** A row is claimable only when it is due, has attempts left, and no unpublished row of the same `aggregate_id` has a lower `aggregate_version`. The gate counts every unpublished earlier row, whether it is leased, backing off, or abandoned.
- **Completion.** A delivered batch is marked with one `UPDATE ... WHERE event_id = ANY($1)`. A failed send or failed marking records a failure for each event in the batch, which replaces the lease with the retry backoff.
- **Guarantee.** Events of one Issue are published in `aggregate_version` order. No order is guaranteed across Issues. Delivery stays at-least-once, and consumers deduplicate by `eventId`.
- **Abandoned events.** An event that exhausts its 20 attempts blocks every later event of that Issue until an operator resets it (see [Health API](../api/health.md#issue-service-health)). Other Issues are unaffected. The abandoned count is reported by Issue Service `/health`.
- **Migrations.** Startup migrations run on one connection under `pg_advisory_lock`, so replicas starting together apply them one at a time.

## Alternatives

- Hold `SELECT ... FOR UPDATE SKIP LOCKED` open while sending to Kafka. Rejected because a slow broker would hold row locks and a pooled connection for the whole send.
- A single publisher elected by advisory lock. Rejected because it adds leader handling while a row-level claim is enough.
- Order by `(occurred_at, event_id)`. Rejected because `aggregate_version` is already strict per Issue and does not depend on clock resolution.
- Order globally. Rejected because consumers only need per-Issue order and a global order would let one stuck Issue stall every Issue.

## Consequences

Replicas can publish concurrently without duplicating normal deliveries. An Issue advances at most one event per publisher poll, so a burst of changes on one Issue is published over several polls. A send that outlives the lease can be claimed and delivered again by another replica; the duplicate is discarded by `eventId` deduplication. An abandoned event holds back that Issue's later notifications until it is reset. Migration `007_outbox_claim.sql` adds a partial index on `(aggregate_id, aggregate_version) WHERE published_at IS NULL` for the gate.
