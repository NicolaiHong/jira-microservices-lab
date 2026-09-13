# ADR 0001: Service Boundaries and Event Propagation

## Status

Accepted — reflected in the implementation.

## Context

The system separates identity, workspace/project, issue, and notification state across four services plus a gateway.

## Decision

- Gateway is a thin public edge; services own domain state.
- Each stateful service owns its own store.
- Issue requests synchronously ask Project for current access context.
- Issue changes write local state/history/outbox atomically, then publish `issue.events.v1`.
- Notification consumes those events into an idempotent Redis recipient projection.

## Consequences

HTTP availability affects request-time Issue authorization. Kafka/notification availability does not reverse a committed Issue change. Cross-service reads/writes occur through contracts, never database access.
