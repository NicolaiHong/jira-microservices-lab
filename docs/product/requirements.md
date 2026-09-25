# Product Requirements

## Purpose

Stable, implementation-traceable business requirements. Every item below is **VERIFIED** unless marked otherwise.

### AUTH-001 — Register account

A visitor can register an account with a unique, valid email and password of at least eight characters. The system creates an active account with IAM role `MEMBER`.

**Acceptance criteria:** duplicate normalized email is rejected; no password is returned; a registered user can log in.

### AUTH-002 — Maintain session

An authenticated user can receive an access token, refresh it through an HttpOnly refresh-token cookie, and log out. Refresh rotates the token; logout revokes the supplied token and clears the cookie.

### WS-001 — Create and discover workspaces

An authenticated user can create a uniquely slugged workspace and list only workspaces in which they have membership. Creation creates the creator's `OWNER` membership.

### WS-002 — Manage workspace membership

`OWNER` and `ADMIN` can add, change, and remove members subject to owner safeguards. The last `OWNER` cannot be removed or demoted; only an `OWNER` can grant or modify an owner role. A member is added by user ID or by the email of a registered account. Every workspace member can list the workspace's members with their account emails.

### PROJ-001 — Manage projects

An `OWNER` or `ADMIN` can create projects in a workspace, update an active project, and archive a project. Project keys are workspace-unique; Project names are workspace-unique case-insensitively while preserving display casing.

### ISSUE-001 — Create and view issues

A workspace member can create and view issues in a visible active project. Each issue belongs to one project and receives a server-generated project-scoped key.

### ISSUE-002 — Maintain an issue

A workspace member can update issue details, assign or unassign a workspace member, and transition status through the fixed workflow. Concurrent stale updates are rejected.

### COMMENT-001 — Record collaboration activity

A workspace member can add comments and read the append-only issue history and comments for a visible issue.

### PLAN-001 — Plan delivery

A workspace member can manage epics and active sprints for a visible active project. An issue may link only to an epic in its project and an active sprint in its project.

### NOTIF-001 — Receive issue-derived notifications

Recipients identified on emitted issue events can list their own notifications and mark one or all as read. Re-delivered events must not duplicate a recipient's notification.

### SEARCH-001 — Filter and page the project issue list

A user who can view a project's issues (ISSUE-001) can filter the project issue list on the server and read it one page at a time. `GET /api/projects/{projectId}/issues` accepts these optional query parameters:

- `status` — `TODO`, `IN_PROGRESS`, or `DONE`;
- `assigneeUserId` — the UUID of the assigned user;
- `sprintId` — the UUID of the linked sprint;
- `q` — text matched case-insensitively anywhere in the issue summary;
- `limit` — page size from 1 to 50, default 25;
- `cursor` — the opaque `nextCursor` value returned with the previous page.

Supplied filters combine with AND. Issues are ordered by `(created_at, id)`, newest first. The response is `{ items, nextCursor }`, and `nextCursor` is `null` on the last page. Read permission is the same as for ISSUE-001. Design: [ADR 0005](../decisions/0005-issue-list-pagination-and-filtering.md).

**Acceptance criteria:**

- Without parameters, a page holds at most 25 issues, and `nextCursor` is non-null only when more issues follow.
- Following `nextCursor` until it is `null` returns every issue that existed when the first page was requested exactly once, including when issues are created between two page requests.
- `status`, `assigneeUserId`, `sprintId`, and `q` each return only matching issues, and combining them returns only issues that match all of them.
- `q` matches regardless of letter case and treats `%` and `_` as literal characters.
- An invalid `status`, UUID, or `limit`, a blank `q` or one longer than 200 characters, an unknown or repeated parameter, or a malformed `cursor` returns `400 VALIDATION_ERROR`.
- A caller without read access to the project receives the same error as for an unfiltered list.
