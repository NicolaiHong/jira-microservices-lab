# Workspaces API

## Purpose

Workspace and membership routes.

| Method/path | Authorization | Request | Success | Validation/errors | Requirement |
| --- | --- | --- | --- | --- | --- |
| `POST /api/workspaces` | Authenticated | name, slug | `201 { workspace }` | name/slug; unique slug | WS-001 |
| `GET /api/workspaces` | Authenticated | — | `200 { items }` | own memberships only | WS-001 |
| `GET /api/workspaces/{id}/members` | Any workspace member | — | `200 { items: [{ userId, email, role, joinedAt, updatedAt }] }` | UUID; `email` is `null` when IAM has no account for the user; `503 IAM_SERVICE_UNAVAILABLE` | WS-002 |
| `POST /api/workspaces/{id}/members` | Owner/Admin; owner only when role `OWNER` | exactly one of `userId` or `email`, plus role | `201 { member }` | UUID/email/role, both identifiers, `404 USER_NOT_FOUND` for an unregistered email, duplicate member, role safeguards, `503 IAM_SERVICE_UNAVAILABLE`, `429 RATE_LIMITED` after 20 additions per user in 10 minutes | WS-002 |
| `PATCH /api/workspaces/{id}/members/{userId}` | Owner/Admin; owner only for owner changes | role | `200 { member }` | UUID/role, last owner | WS-002 |
| `DELETE /api/workspaces/{id}/members/{userId}` | Owner/Admin; owner only for owner removal | — | `204` | last owner, nonmember | WS-002 |

All routes require bearer authentication. Private membership failures use not-found where the actor lacks membership. Member emails are resolved by Project Service through IAM after authorization ([ADR 0003](../decisions/0003-workspace-member-identity-lookup.md)).
