# Project Management Flow

## Purpose

Create, view, modify, and archive projects inside a workspace.

## Actors

- Workspace `OWNER`
- Workspace `ADMIN`
- Workspace `MEMBER`

## Preconditions

Caller belongs to the workspace; writers are owner or admin.

## Trigger

Project create, list, read, update, or archive request.

## Main Flow

1. Gateway authenticates and forwards caller context.
2. Project Service checks workspace membership and, for writes, project-management role.
3. It trims and validates project values, then enforces workspace-scoped key uniqueness and case-insensitive name uniqueness.
4. It persists or returns the project.

## Alternative Flows

### A1 — Archive

Archive conditionally marks an active Project `ARCHIVED`; repeating archive is idempotent. Project detail updates also mutate conditionally on `ACTIVE`, so an archive that commits first makes a stale update return `PROJECT_ARCHIVED`.

### A2 — Partial update

PATCH preserves omitted `name` and `description`. An explicit null description clears it; a blank description normalizes to null. `{}` returns the current Project without a database mutation or `updated_at` change.

## Failure / Error Flows

Non-members get not found; members without management role get forbidden; archived project updates and duplicate key/name are rejected.

## Business Rules

[BR-PROJ-001](../product/business-rules.md#br-proj-001--project-uniqueness-and-archival).

## State Transitions

`ACTIVE → ARCHIVED`; no restoration endpoint exists.

## Permissions

Members can read; owners/admins manage. See [matrix](../reference/permissions-matrix.md).

## Data Affected

`projects` in `project_db`.

## API Dependencies

`POST/GET /api/workspaces/{workspaceId}/projects`, `GET/PATCH/DELETE /api/projects/{projectId}`.

## UI Entry Points

`/projects` lists and creates projects. **OPEN QUESTION:** no verified project-update/archive UI exists.

## Validation

Name maximum 120; key maximum 20, normalized uppercase ASCII letters/numbers; description maximum 2,000.

## Edge Cases

Archival prevents Issue and planning writes but does not hide reads.

## Acceptance Criteria

### AC-PROJ-001

Given an owner/admin, when creating a unique project, then it is active and has a workspace-scoped key.

## Related Documentation

[projects API](../api/projects.md), [project feature](../features/projects.md).
