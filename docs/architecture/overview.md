# Architecture Overview

## Purpose

Describe the **VERIFIED** runtime topology and ownership boundaries.

```mermaid
flowchart LR
  Web[Next.js web client] --> Gateway[NestJS API gateway]
  Gateway --> IAM[Spring Boot IAM]
  Gateway --> Project[ASP.NET Core Project]
  Gateway --> Issue[NestJS Issue]
  Gateway --> Notification[Go Notification]
  Gateway -->|auth rate limit| Redis[(Redis)]
  IAM --> IAMDB[(iam_db)]
  Project --> ProjectDB[(project_db)]
  Project -->|member identity lookup| IAM
  Issue --> IssueDB[(issue_db)]
  Issue -->|access-context| Project
  Issue -->|outbox → issue.events.v1| Kafka[Redpanda / Kafka]
  Kafka --> Notification
  Notification -->|current recipient access| Project
  Notification -->|notification keys| Redis
  Notification -.->|failed events| DLQ[issue.events.v1.dlq.v1]
```

The browser calls the gateway only. Draw.io source and rendered images of this topology and the event flow live in [`diagrams/`](../../diagrams/); see [diagrams](../diagrams/README.md). Each service owns its persistence; local Docker Compose does not make databases shared domain stores. See [module boundaries](module-boundaries.md) and [data overview](../data/database-overview.md).
