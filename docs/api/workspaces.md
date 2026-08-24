# Workspaces API

## Purpose

Workspace and membership routes.

| Method/path | Authorization | Request | Success | Validation/errors | Requirement |
| --- | --- | --- | --- | --- | --- |
| `POST /api/workspaces` | Authenticated | name, slug | `201 { workspace }` | name/slug; unique slug | WS-001 |
| `GET /api/workspaces` | Authenticated | — | `200 { items }` | own memberships only | WS-001 |
| `POST /api/workspaces/{id}/members` | Owner/Admin; owner only when role `OWNER` | userId, role | `201 { member }` | UUID/role, duplicate member, role safeguards | WS-002 |
| `PATCH /api/workspaces/{id}/members/{userId}` | Owner/Admin; owner only for owner changes | role | `200 { member }` | UUID/role, last owner | WS-002 |
| `DELETE /api/workspaces/{id}/members/{userId}` | Owner/Admin; owner only for owner removal | — | `204` | last owner, nonmember | WS-002 |

All routes require bearer authentication. Private membership failures use not-found where the actor lacks membership.
