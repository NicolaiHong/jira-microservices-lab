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

## Issue list indexes

`issue_db` serves the paged project issue list ([ADR 0005](../decisions/0005-issue-list-pagination-and-filtering.md)) from B-tree indexes on `issues(project_id, created_at, id)` and on `(project_id, <filter>, created_at, id)` for `status`, `assignee_user_id`, and `sprint_id`, plus a GIN `pg_trgm` index on `summary` for the `q` filter. Issue Service migrations create the `pg_trgm` extension, so the database user needs `CREATE` privilege on `issue_db`.
