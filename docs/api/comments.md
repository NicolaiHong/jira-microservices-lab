# Comments API

## Purpose

Issue comments and activity-history routes.

| Method/path | Authorization | Request | Success | Validation/errors | Requirement |
| --- | --- | --- | --- | --- | --- |
| `POST /api/issues/{issueId}/comments` | Workspace member, active project | `body` | `201 { comment }` | trimmed, nonblank, ≤5,000 chars; concurrent issue change | COMMENT-001 |
| `GET /api/issues/{issueId}/comments` | Workspace member | — | `200 { items }` | visible issue | COMMENT-001 |
| `GET /api/issues/{issueId}/history` | Workspace member | — | `200 { items }` | visible issue | COMMENT-001 |

No comment update/delete contract exists.

`POST` has no idempotency-key guarantee. The client does not automatically retry an uncertain business mutation; a Gateway authentication rejection may still use the existing one-time refresh/replay flow because it precedes business execution.
