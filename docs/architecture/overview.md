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
  IAM --> IAMDB[(iam_db)]
  Project --> ProjectDB[(project_db)]
  Issue --> IssueDB[(issue_db)]
  Issue -->|issue.events.v1| Kafka[Redpanda / Kafka]
  Kafka --> Notification
  Notification -->|current recipient access| Project
  Notification --> Redis[(Redis)]
```

The browser calls the gateway only. Each service owns its persistence; local Docker Compose does not make databases shared domain stores. See [module boundaries](module-boundaries.md) and [data overview](../data/database-overview.md).
