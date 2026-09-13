# Backend Architecture

## Purpose

Define server responsibilities and interaction style.

| Component | Responsibility | Inbound boundary |
| --- | --- | --- |
| API Gateway | Public routes, JWT check, CORS, correlation IDs, downstream error translation | Public HTTP |
| IAM | Accounts, password verification, JWT/access and refresh-token lifecycle | Gateway internal HTTP |
| Project | Workspaces, memberships, project lifecycle, access context | Gateway and Issue internal HTTP |
| Issue | Issues, comments, history, epics, sprints, outbox | Gateway internal HTTP |
| Notification | Kafka consumer and recipient notification projection | Kafka and Gateway internal HTTP |

Request-time access checks use HTTP: Issue asks Project for membership and project status. Cross-service notification propagation uses `issue.events.v1`, not a distributed transaction.
