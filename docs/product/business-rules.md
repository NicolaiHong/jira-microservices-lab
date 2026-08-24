# Business Rules

## Purpose

Central catalogue of verified business invariants. These rules are implemented by the owning service, not by the gateway.

### BR-AUTH-001 — Normalized unique identities

Email is trimmed/lowercased before registration and login; uniqueness is enforced case-insensitively. Password hashes and refresh-token hashes, never raw values, are persisted.

### BR-AUTH-002 — Session safety

A refresh token is usable only while active and unexpired. Successful refresh rotates it. Blocked users cannot log in or refresh.

### BR-WS-001 — Creation establishes ownership

Creating a workspace creates an `OWNER` membership for its creator in the same save operation.

### BR-PERM-001 — Owner safeguards

`OWNER` and `ADMIN` manage members; only `OWNER` can create/change/remove an owner membership; a workspace keeps at least one owner.

### BR-PROJ-001 — Project uniqueness and archival

Project names are trimmed, at most 120 characters, and unique case-insensitively within a workspace while preserving display casing. Project keys are trimmed, uppercased ASCII letters/numbers, at most 20 characters, and unique within a workspace. Archived projects cannot change and reject issue/planning writes; archiving is idempotent. Archived-project issues remain readable to members, but creation, details changes, assignment, and status transitions return `PROJECT_ARCHIVED`. A detail mutation writes only while the persisted Project is active, so a committed archive prevents a stale later detail update.

For a Project PATCH, omitted `name` and `description` preserve their stored values; explicit `description: null` clears it; whitespace-only descriptions normalize to null. An empty PATCH returns the current Project without changing `updated_at`.

### BR-ISSUE-001 — Project-scoped identity

An issue has exactly one project, a positive sequential number unique in that project, and a key `{PROJECT_KEY}-{number}`. It starts in `TODO`. Its reporter is derived from the authenticated creator and is immutable.

### BR-ISSUE-002 — Valid issue content

Summary is required (maximum 200 characters); description is optional (maximum 5,000); type is `TASK`, `BUG`, or `STORY`; priority is `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`. Description is presence-aware: omission during PATCH preserves it; `null`, empty, and whitespace-only values clear it; non-empty values are trimmed. PostgreSQL enforces the 5,000-character description limit.

### BR-ISSUE-003 — Assignment and links

Assignee is optional and, when supplied, must currently have workspace access to the project. Removing a user from a workspace does not retrospectively clear that user's historical assignee ID from existing issues. Epic must belong to the project; sprint must belong to the project and be `ACTIVE`.

### BR-STATUS-001 — Fixed status transitions

Only `TODO → IN_PROGRESS`, `IN_PROGRESS → TODO|DONE`, and `DONE → IN_PROGRESS` are valid. Same-state transitions are invalid.

### BR-ISSUE-004 — Change history and delivery event

Creation, detail updates, assignment, transitions, and comments each create issue history and an outbox event in the local issue transaction. Core detail PATCH, assignment PATCH, and status transition require a positive integer `expectedVersion`. The service first rejects a loaded-version mismatch with `409 CONCURRENT_ISSUE_MODIFICATION`; its PostgreSQL `UPDATE ... WHERE id = ? AND version = expectedVersion` compare-and-swap remains authoritative. A stale write has no Issue, history, or outbox side effects and is never automatically retried.

### BR-PLAN-001 — One active sprint

At most one sprint per project can be `ACTIVE`; a completed sprint cannot be completed again. Epic and sprint date ranges require start date not after end/target date.

### BR-NOTIF-001 — Recipient-owned, event-derived notifications

Notifications are derived projections, not issue truth. A notification belongs to one recipient; deterministic event/recipient identifiers make consumer redelivery idempotent. Mark-read is idempotent.
