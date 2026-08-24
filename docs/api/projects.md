# Projects API

## Purpose

Workspace project lifecycle routes.

| Method/path | Authorization | Request | Success | Validation/errors | Requirement |
| --- | --- | --- | --- | --- | --- |
| `POST /api/workspaces/{workspaceId}/projects` | Owner/Admin | name, key, description? | `201 { project }` | name (trimmed, max 120, case-insensitive workspace uniqueness); key (trimmed uppercase ASCII A-Z/0-9, max 20, workspace uniqueness) | PROJ-001 |
| `GET /api/workspaces/{workspaceId}/projects` | Member | — | `200 { items }` | inaccessible workspace not found | PROJ-001 |
| `GET /api/projects/{projectId}` | Member | — | `200` project object | inaccessible/not found | PROJ-001 |
| `PATCH /api/projects/{projectId}` | Owner/Admin | name?, description? | `200 { project }` | omitted fields retained; `description: null` or blank clears; `{}` is a no-op; archived/duplicate name | PROJ-001 |
| `DELETE /api/projects/{projectId}` | Owner/Admin | — | `204` | archive is idempotent | PROJ-001 |

`DELETE` means archive, not physical deletion.

`key` and `workspaceId` are immutable through PATCH. A PATCH after an archive commits returns `409 PROJECT_ARCHIVED`; concurrent active PATCH requests remain last-write-wins.

## Internal access-context contract

Notification Service and Issue Service use the internal route below; it is not a browser route and requires the shared internal-service secret.

| Method/path | Required headers | Success | Access failure |
| --- | --- | --- | --- |
| `GET /internal/projects/{projectId}/access-context` | `x-authenticated-user-id`, `x-internal-service-secret`, `x-correlation-id` | `200 { projectId, workspaceId, projectKey, projectStatus, membershipRole }` | documented `404 PROJECT_NOT_FOUND` for a nonexistent project or current non-member |

A current member receives `200` even when `projectStatus` is `ARCHIVED`; archive blocks writes but does not remove read access.
