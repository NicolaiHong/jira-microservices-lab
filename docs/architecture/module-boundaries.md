# Module Boundaries

## Purpose

Record the ownership rules that prevent domain leakage.

| Boundary | Rule |
| --- | --- |
| Gateway → services | Gateway forwards authenticated identity, correlation ID, body, and mapped errors; it owns no workspace, project, issue, or notification state. |
| IAM → others | Other services store IAM user UUIDs as external references; none reads `iam_db`. |
| Project → Issue | Issue receives project key/membership/status through `/internal/projects/{id}/access-context`, never by reading `project_db`. |
| Issue → Notification | Issue writes its own state and outbox locally, then publishes; Notification never changes issue state. |
| Notification → Redis | Redis is a recipient projection, not a system of record for issues or accounts. |

Cross-boundary changes require an ADR and contract update.
