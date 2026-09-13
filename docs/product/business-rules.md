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

Project names are trimmed, at most 120 characters, and unique case-insensitively within a workspace while preserving display casing. Project keys are trimmed, uppercased ASCII letters/numbers, at most 20 characters, and unique within a workspace. Archived projects cannot change and reject issue/planning writes; archiving is idempotent. Archived-project issues remain readable to members, but creation, details changes, assignment, and status transitions return `PROJECT_ARCHIVED`. Each issue write performs a request-time active-Project check; because Project and Issue own separate stores, an archive that commits after that check can still race the Issue write (accepted TOCTOU boundary).

For a Project PATCH, omitted `name` and `description` preserve their stored values; explicit `description: null` clears it; whitespace-only descriptions normalize to null. An empty PATCH returns the current Project without changing `updated_at`.

### BR-ISSUE-001 — Project-scoped identity

An issue has exactly one project, a positive sequential number unique in that project, and a key `{PROJECT_KEY}-{number}`. It starts in `TODO`. Its reporter is derived from the authenticated creator and is immutable.

### BR-ISSUE-002 — Valid issue content

Summary is required (maximum 200 characters); description is optional (maximum 5,000); type is `TASK`, `BUG`, or `STORY`; priority is `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`. Description is presence-aware: omission during PATCH preserves it; `null`, empty, and whitespace-only values clear it; non-empty values are trimmed. PostgreSQL enforces the 5,000-character description limit.

### BR-ISSUE-003 — Assignment and links

Assignee is optional and, when supplied, must currently have workspace access to the project. Removing a user from a workspace does not retrospectively clear that user's historical assignee ID from existing issues. Epic must belong to the project; sprint must belong to the project and be `ACTIVE`.

### BR-STATUS-001 — Fixed status transitions

Issues start in `TODO`. The only valid transitions are `TODO → IN_PROGRESS`, `IN_PROGRESS → TODO|DONE`, and `DONE → IN_PROGRESS`. Same-state transitions and every other edge are invalid. `DONE` is reopenable, so there is no terminal issue state. The same graph applies to `TASK`, `BUG`, and `STORY`; visible `MEMBER`, `ADMIN`, and `OWNER` memberships have equal transition permissions on an active Project.

### BR-ISSUE-004 — Change history, delivery event, and concurrency

Creation, real detail updates, assignment, transitions, and comments each create issue history and an outbox event in their local Issue Service transaction. A real core-detail PATCH, assignment PATCH, and status transition require a positive safe-integer `expectedVersion`. A core PATCH with none of `summary`, `description`, `type`, or `priority` is a visibility-only no-op: it validates body shape and validates `expectedVersion` syntax only when supplied, returns the current Issue, and creates no CAS, version, history, or outbox side effect.

For a transition, validation occurs in this order: request/body and requested-status validation; Project visibility and active-write validation; `expectedVersion` validation and loaded-version conflict check; then graph legality. PostgreSQL `UPDATE ... WHERE id = ? AND version = expectedVersion` remains authoritative. A stale write returns `409 CONCURRENT_ISSUE_MODIFICATION`, has no Issue/history/outbox side effects, and is never automatically retried.

A successful transition changes the status and increments the version once, writes exactly one `STATUS_CHANGED` history row, and writes exactly one `issue.transitioned` outbox event in the same PostgreSQL transaction. Failure of any of those local persistence steps rolls the transition back.

### BR-PLAN-001 — One active sprint

At most one sprint per project can be `ACTIVE`; a completed sprint cannot be completed again. Epic and sprint date ranges require start date not after end/target date.

### BR-NOTIF-001 — Recipient-owned, event-derived notifications

Notifications are derived projections, not issue truth. A notification belongs to one recipient; deterministic event/recipient identifiers make consumer redelivery idempotent. Mark-read is idempotent. Historical Issue identities and event candidates remain immutable, but Notification Service verifies each non-actor candidate's current Project read access immediately before creating a new projection. The documented absent/non-member `404` skips that candidate; all other Project access failures retry the event without Redis writes. Archived Project membership remains current read access.
