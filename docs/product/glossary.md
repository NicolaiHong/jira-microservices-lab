# Glossary

| Term | Meaning |
| --- | --- |
| IAM role | Account-level role emitted in JWT; currently registration creates `MEMBER`. |
| Workspace membership | Per-workspace authorization record with `OWNER`, `ADMIN`, or `MEMBER`. |
| Project | Workspace-owned container for issues, epics, and sprints. |
| Issue key | Server-generated project-scoped identifier such as `JCB-1`. |
| Issue history | Immutable record of verified issue actions. |
| Outbox event | Issue-database row stored with a change and later published to Kafka. |
| Notification | Redis projection created from an issue event for a recipient. |
| Correlation ID | `x-correlation-id`, preserved across HTTP calls for tracing. |
