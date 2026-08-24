# Database Overview

## Purpose

Explain persistence ownership.

| Store | Owner | Contents |
| --- | --- | --- |
| `iam_db` PostgreSQL | IAM | Users, roles, hashed refresh tokens |
| `project_db` PostgreSQL | Project | Workspaces, workspace memberships, projects |
| `issue_db` PostgreSQL | Issue | Issues, comments, history, sequences, outbox, epics, sprints |
| Redis | Notification | Recipient notifications and indexes |

The Compose PostgreSQL server hosts logical databases for local development only. No service may query another service-owned database.
