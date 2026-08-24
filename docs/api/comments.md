# Comments API

## Purpose

Issue comments and activity-history routes.

| Method/path | Authorization | Request | Success | Validation/errors | Requirement |
| --- | --- | --- | --- | --- | --- |
| `POST /api/issues/{issueId}/comments` | Workspace member, active project | `body` | `201 { comment }` | required ≤5,000 chars; concurrent issue change | COMMENT-001 |
| `GET /api/issues/{issueId}/comments` | Workspace member | — | `200 { items }` | visible issue | COMMENT-001 |
| `GET /api/issues/{issueId}/history` | Workspace member | — | `200 { items }` | visible issue | COMMENT-001 |

No comment update/delete contract exists.
