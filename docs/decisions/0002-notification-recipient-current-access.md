# ADR 0002: Notification Recipient Current-Access Revalidation

## Status

Accepted — reflected in the implementation.

## Context

Issue events preserve historical actor, reporter, assignee, and candidate-recipient identifiers. Workspace membership can later be removed, however, and a Redis notification projection must not create a new notification for someone who no longer has current Project read access. Notification processing is asynchronous and its Redis projection is idempotent, but recipient eligibility needs a current authorization decision.

## Decision

Immediately before projecting every supported Issue event (`issue.created`, `issue.updated`, `issue.assigned`, `issue.transitioned`, and `issue.commented`), Notification Service calls Project Service's internal `GET /internal/projects/{projectId}/access-context` once for every normalized, deduplicated, non-actor candidate recipient.

The request contains the candidate identity, shared internal secret, and event ID as correlation ID. A valid `200` makes the recipient eligible, and the documented `404 PROJECT_NOT_FOUND` skips that recipient. Notification Service waits for every required check before doing any Redis write, then stores all eligible deterministic recipient records in the existing batched operation. A Project archived state still permits current read access.

## Alternatives

- Trust event recipient IDs forever. Rejected because removed members would receive new notifications.
- Put Project membership data in Notification's Redis projection. Rejected because it duplicates a Project-owned authorization model and introduces synchronization drift.
- Ask Project Service during Issue writes only. Rejected because membership can change between the write and later event projection.
- Make Issue, Project, Kafka, and Redis one distributed transaction. Rejected because it violates service ownership and operationally couples independent stores.

## Consequences

Notification Service now has a synchronous Project Service dependency while it is asynchronously processing Kafka records. Project outages can delay notification projection and increase Kafka lag, but cannot roll back committed Issue changes. Historical Issue identities remain preserved; only new projection eligibility is revalidated.

## Failure semantics

A documented Project `404 PROJECT_NOT_FOUND` is a successful recipient skip. Project timeouts, transport errors, `5xx`, malformed successful responses, unexpected `4xx`, and invalid internal authentication/configuration are processing failures: Notification Service makes no Redis writes for that event and retries the Kafka record. A retryable failure cannot be committed past; after a successful DLQ write the record may be committed, while DLQ or commit failure leaves it uncommitted.

## Accepted TOCTOU

Project access is checked immediately before the Redis batch, but no distributed transaction can atomically bind that check to the Redis write. A membership change in the small interval is accepted. The next event will be checked against current access again.
