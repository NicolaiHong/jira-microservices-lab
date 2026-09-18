# Data Flow

## Purpose

Explain the main verified request and event paths.

```mermaid
sequenceDiagram
  participant UI as Web client
  participant GW as Gateway
  participant I as Issue service
  participant P as Project service
  participant DB as issue_db
  participant K as Kafka
  participant N as Notification
  UI->>GW: authenticated issue command
  GW->>I: internal HTTP + identity + correlation ID
  I->>P: access-context check
  P-->>I: membership, key, project status
  I->>DB: issue/history/outbox in local transaction
  I-->>GW: response
  DB->>K: outbox publisher (poll 2s, per-event backoff, 20 attempts)
  K->>N: issue.events.v1 (group notification-service-v1)
  N->>P: current access check for each candidate recipient
  P-->>N: eligible / documented not found
  alt all checks succeed
    N->>N: deterministic recipient projection in Redis
  else permanent error or 5 failed attempts
    N->>K: issue.events.v1.dlq.v1 + failure-reason header
  end
  N->>K: commit offset
  UI->>GW: GET /api/notifications (poll 5s)
  GW->>N: internal HTTP
```

An unavailable Project service blocks Issue requests with a stable 503. An unavailable Kafka broker does not roll back the committed Issue transaction; pending outbox publication retries with per-event exponential backoff (1 s doubling, capped at 5 minutes). After 20 failed attempts an event stops retrying and Issue Service `/health` reports it as abandoned.

Notification processing also makes a synchronous Project Service read while handling an asynchronous Kafka event. A Project outage therefore delays notification projection and can increase Kafka lag, but it does not reverse the already-committed Issue change.
