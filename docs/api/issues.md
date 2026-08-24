# Issues API

## Purpose

Issue creation, retrieval, mutation, assignment, and workflow routes.

| Method/path | Authorization | Request | Success | Validation/errors | Requirement |
| --- | --- | --- | --- | --- | --- |
| `POST /api/projects/{projectId}/issues` | Workspace member, active project | summary, description?, type, priority, assigneeUserId?, epicId?, sprintId? | `201 { issue }` | content/UUID/link rules, archived project | ISSUE-001 |
| `GET /api/projects/{projectId}/issues` | Workspace member | — | `200 { items }` | project visible | ISSUE-001 |
| `GET /api/issues/{issueId}` | Workspace member | — | `200 { issue }` | issue/project visible | ISSUE-001 |
| `PATCH /api/issues/{issueId}` | Workspace member, active project | partial summary, description, type, priority, positive integer `expectedVersion` | `200 { issue }` | content, immutable reporter/project/key/number/status fields, concurrent update | ISSUE-002 |
| `PATCH /api/issues/{issueId}/assignee` | Workspace member, active project | assigneeUserId?, positive integer `expectedVersion` | `200 { issue }` | current assignee project access, concurrent update | ISSUE-002 |
| `POST /api/issues/{issueId}/transitions` | Workspace member, active project | status, positive integer `expectedVersion` | `200 { issue }` | allowed transition, concurrent update | ISSUE-002 |

Issue payload enums: type `TASK|BUG|STORY`; priority `LOW|MEDIUM|HIGH|CRITICAL`; status `TODO|IN_PROGRESS|DONE`. `expectedVersion` must be a positive integer; a stale value returns `409 CONCURRENT_ISSUE_MODIFICATION` and does not mutate issue/history/outbox state. The core PATCH never changes reporter, project, key, number, or status; use the transition endpoint for status. Description PATCH is presence-aware: omission preserves, `null`/empty/whitespace clear, and non-empty values are trimmed to at most 5,000 characters. No query filtering/pagination/sorting is currently supported.
