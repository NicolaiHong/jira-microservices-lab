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
5. Listing members requires membership; Project Service resolves member emails with one IAM lookup.

### A2 — Add a member by email

After the member-manager and owner-role checks pass, Project Service resolves the email through IAM. An unregistered email returns `404 USER_NOT_FOUND`; otherwise the membership is added as for a user ID. The Gateway limits each user to 20 member additions per 10 minutes.

## Alternative Flows

### A1 — Change membership role

Only an owner may make a role owner or alter/remove an existing owner.

## Failure / Error Flows

Duplicate slug, non-member visibility, insufficient role, duplicate target membership, missing member, unregistered email, and last-owner removal/demotion are rejected. IAM unavailability fails member listing and email-based addition with `503 IAM_SERVICE_UNAVAILABLE` and writes nothing.

## Business Rules

[BR-WS-001](../product/business-rules.md#br-ws-001--creation-establishes-ownership), [BR-PERM-001](../product/business-rules.md#br-perm-001--owner-safeguards).

## State Transitions

Membership role changes among `OWNER`, `ADMIN`, and `MEMBER`; a workspace cannot have zero owners.

## Permissions

See the [permissions matrix](../reference/permissions-matrix.md).

## Data Affected

`workspaces`, `workspace_members` in `project_db`.

## API Dependencies

`POST/GET /api/workspaces`, `GET/POST /api/workspaces/{id}/members`, `PATCH/DELETE /api/workspaces/{id}/members/{userId}`; internal IAM `POST /internal/users/lookup`.

## UI Entry Points

`/projects` creates/lists workspaces and, for the selected workspace, lists members. `OWNER` and `ADMIN` add members by email and change or remove the memberships their role permits. Issue assignee pickers list the project's workspace members.

## Validation

Workspace name maximum 120; slug maximum 80 and normalized by Project Service; role must be an allowed workspace role.

## Edge Cases

Non-members are deliberately treated as not found for private workspace access.

## Acceptance Criteria

### AC-WS-001

Given an authenticated user, when they create a valid workspace, then they receive an `OWNER` membership and it appears in their list.

## Related Documentation

[workspaces API](../api/workspaces.md), [roles](../product/actors-and-roles.md).
