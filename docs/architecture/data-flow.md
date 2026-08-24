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
  DB->>K: outbox publisher
  K->>N: issue.events.v1
  N->>N: deterministic recipient projection in Redis
```

An unavailable Project service blocks Issue requests with a stable 503. An unavailable Kafka broker does not roll back the committed Issue transaction; pending outbox publication retries.
