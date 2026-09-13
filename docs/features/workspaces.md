# Workspaces Feature

## Purpose

Workspace creation and membership-scoped discovery.

## Related Requirements

WS-001.

## Related Business Flows

[Workspace management](../flows/workspace-management.md).

## Responsibilities

Project Service owns workspaces/memberships; Gateway forwards caller identity.

## UI

`/projects` workspace list and creation form.

## State

`workspaces`, `workspace_members` in `project_db`; React Query cache.

## API Usage

See [workspaces API](../api/workspaces.md).

## Validation

Name/slug validation and uniqueness occur in Project Service.

## Authorization

Authenticated users create/list only their workspace memberships.

## Error Handling

Duplicate slug and inaccessible workspaces map to stable errors.

## Important Components / Modules

Project `CreateWorkspaceUseCase`, client `WorkspaceProjectDashboard`.

## Tests

Focused Project Service, Gateway, and client Workspace verification covers
creation, membership visibility and permissions, stable conflict responses, and
owner/duplicate-membership concurrency behavior.

## Known Limitations

No workspace deletion/rename endpoint.

## Open Questions

Workspace lifecycle beyond creation has no verified product requirement.
