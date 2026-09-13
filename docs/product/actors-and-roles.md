# Actors and Roles

## Purpose

Describe roles verified in the implementation. IAM and workspace roles are separate concepts.

| Actor / role | Scope | Allowed actions | Restricted actions |
| --- | --- | --- | --- |
| Unauthenticated visitor | Public gateway | Register and log in | All workspace, project, issue, planning, and notification actions |
| IAM `MEMBER` | Account-wide JWT claim | Authenticate and use any workspace membership | Does not itself grant workspace access |
| Workspace `OWNER` | One workspace | All verified workspace-member and project management actions; can grant or retain `OWNER` | Cannot remove or demote the last owner |
| Workspace `ADMIN` | One workspace | Add, change, and remove non-owner members; create, update, and archive projects | Cannot grant, change, or remove an `OWNER` membership |
| Workspace `MEMBER` | One workspace | Read workspace projects; read/create/update/assign/transition/comment on visible-project issues; read/create/update epics and create/complete sprints | Cannot manage members or projects |
| Notification recipient | Own Redis projection | Read and mark own notifications | Cannot read or mark another user's notification |

Issue writes require visible project access and an `ACTIVE` project; current code does not further restrict issue writers by workspace role. See [permissions matrix](../reference/permissions-matrix.md).
