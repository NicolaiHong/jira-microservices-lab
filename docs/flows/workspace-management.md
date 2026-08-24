# Workspace Management Flow

## Purpose

Create a workspace, discover memberships, and manage members.

## Status

**COMPLETE** — PostgreSQL concurrency verification confirms owner safeguards and stable duplicate-membership conflicts.

## Actors

- Authenticated user
- Workspace `OWNER`
- Workspace `ADMIN`
- Workspace `MEMBER`

## Preconditions

Caller has a valid access token; membership changes require existing actor membership.

## Trigger

Create/list workspace or add/change/remove member request.

## Main Flow

1. Gateway authenticates the caller and forwards identity to Project Service.
2. Workspace creation validates name/slug, stores the workspace, and creates creator `OWNER` membership.
3. Listing returns only memberships for the caller.
4. For membership management, Project Service verifies role and mutates the target membership.

## Alternative Flows

### A1 — Change membership role

Only an owner may make a role owner or alter/remove an existing owner.

## Failure / Error Flows

Duplicate slug, non-member visibility, insufficient role, duplicate target membership, missing member, and last-owner removal/demotion are rejected.

## Business Rules

[BR-WS-001](../product/business-rules.md#br-ws-001--creation-establishes-ownership), [BR-PERM-001](../product/business-rules.md#br-perm-001--owner-safeguards).

## State Transitions

Membership role changes among `OWNER`, `ADMIN`, and `MEMBER`; a workspace cannot have zero owners.

## Permissions

See the [permissions matrix](../reference/permissions-matrix.md).

## Data Affected

`workspaces`, `workspace_members` in `project_db`.

## API Dependencies

`POST/GET /api/workspaces`, `POST /api/workspaces/{id}/members`, `PATCH/DELETE /api/workspaces/{id}/members/{userId}`.

## UI Entry Points

`/projects` creates/lists workspaces. **OPEN QUESTION:** no member-management UI exists.

## Validation

Workspace name maximum 120; slug maximum 80 and normalized by Project Service; role must be an allowed workspace role.

## Edge Cases

Non-members are deliberately treated as not found for private workspace access.

## Acceptance Criteria

### AC-WS-001

Given an authenticated user, when they create a valid workspace, then they receive an `OWNER` membership and it appears in their list.

## Related Documentation

[workspaces API](../api/workspaces.md), [roles](../product/actors-and-roles.md).
