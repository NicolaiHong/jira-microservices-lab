# Entities

## Purpose

Business meaning of persisted entities.

| Owner | Entity | Meaning |
| --- | --- | --- |
| IAM | User | Account with normalized email, status, password hash, and IAM roles. |
| IAM | RefreshToken | Revocable, expiring hashed session credential. |
| Project | Workspace | Membership-scoped container, created with an owner. |
| Project | WorkspaceMember | A user's authorization role in a workspace. |
| Project | Project | Work container with workspace-scoped name/key and lifecycle status. |
| Issue | Issue | Project work item with reporter, optional assignee/epic/sprint, state, version, and project-scoped key. |
| Issue | IssueComment | Comment authored against an issue. |
| Issue | IssueHistory | Immutable recorded action/change on an issue. |
| Issue | OutboxEvent | Reliably staged event awaiting publication. |
| Issue | Epic / Sprint | Project planning records; sprint has `ACTIVE` or `COMPLETED` status. |
| Notification | Notification | Event-derived, user-owned Redis projection. |
