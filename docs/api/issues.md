# Issues API

## Purpose

Issue creation, retrieval, mutation, assignment, and workflow routes.

| Method/path | Authorization | Request | Success | Validation/errors | Requirement |
| --- | --- | --- | --- | --- | --- |
| `POST /api/projects/{projectId}/issues` | Workspace member, active project | summary, description?, type, priority, assigneeUserId?, epicId?, sprintId? | `201 { issue }` | content/UUID/link rules, archived project | ISSUE-001 |
| `GET /api/projects/{projectId}/issues` | Workspace member | — | `200 { items }` | project visible | ISSUE-001 |
| `GET /api/issues/{issueId}` | Workspace member | — | `200 { issue }` | issue/project visible | ISSUE-001 |
| `PATCH /api/issues/{issueId}` | Workspace member; active project only for a real mutation | partial summary, description, type, priority; positive safe-integer `expectedVersion` required for a real mutation | `200 { issue }` | content, immutable reporter/project/key/number/status fields, concurrent update | ISSUE-002 |
| `PATCH /api/issues/{issueId}/assignee` | Workspace member, active project | assigneeUserId?, positive safe-integer `expectedVersion` | `200 { issue }` | current assignee project access, concurrent update | ISSUE-002 |
| `POST /api/issues/{issueId}/transitions` | Workspace member, active project | status, positive safe-integer `expectedVersion` | `200 { issue }` | allowed transition, concurrent update | ISSUE-002 |

Issue payload enums: type `TASK|BUG|STORY`; priority `LOW|MEDIUM|HIGH|CRITICAL`; status `TODO|IN_PROGRESS|DONE`. `expectedVersion` is a positive safe integer; a stale value returns `409 CONCURRENT_ISSUE_MODIFICATION` and does not mutate Issue/history/outbox state. The core PATCH rejects public `status`, `key`, `number`, `reporterUserId`, and `projectId` with `400 VALIDATION_ERROR`; status may change only through the transition endpoint. Description PATCH is presence-aware: omission preserves, `null`/empty/whitespace clear, and non-empty values are trimmed to at most 5,000 characters.

A PATCH with none of `summary`, `description`, `type`, or `priority` validates body shape and a supplied `expectedVersion` syntax only, performs visibility-only access, and returns the current Issue without CAS/version/history/outbox effects; it does not require an active Project solely for that no-op. For a transition, error precedence is body/status validation, Project visibility/writable state, expected-version validation/conflict, then graph legality. A successful transition atomically updates status/version once and writes exactly one `STATUS_CHANGED` history row plus one `issue.transitioned` outbox event. No query filtering, pagination, sorting, or transition idempotency-key contract is currently supported.
