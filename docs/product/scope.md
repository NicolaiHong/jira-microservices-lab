# Product Scope

## Purpose

Define the verified scope of this Jira-like project and issue-management MVP.

## Included — VERIFIED

- Account registration, login, refresh-token rotation, logout, and authenticated identity retrieval.
- User-owned workspaces with `OWNER`, `ADMIN`, and `MEMBER` memberships, managed by email from the web client.
- Project creation, retrieval, update, listing, and archival within a workspace.
- Issues with project-scoped keys, assignment, a fixed three-state workflow, comments, history, and optimistic concurrency protection.
- Epics, one active sprint per project, and completed-sprint lifecycle.
- Server-side filtering of the project issue list by status, assignee, sprint, and summary text, with cursor pagination (SEARCH-001).
- Asynchronous notifications derived from issue events.
- A Next.js client for authentication, workspace/project selection, backlog, board, issue detail, roadmap, and notifications.

## Not currently in scope — VERIFIED

- Workspace deletion, project restoration, user administration/blocking UI, and member invitations for unregistered emails.
- Issue deletion, comment editing/deletion, attachments, labels, estimates, releases, and configurable workflows.
- Issue list sort options, priority or key filters, a full-text search engine, and notification pagination. The board's text search (key and summary) and priority filter run in the browser over the complete issue list.
- WebSocket notification delivery; the client polls every five seconds.

## OPEN QUESTION

Whether the product should add administrative workflows, configurable permissions, or richer Jira planning concepts has no verified requirement. Treat each as new scope requiring a requirement and, if architectural, an ADR.
