# Members and Permissions Feature

## Purpose

Workspace role management and authorization context.

## Related Requirements

WS-002.

## Related Business Flows

[Workspace management](../flows/workspace-management.md).

## Responsibilities

Project Service is the authority for workspace roles and access context; Issue consumes that context.

## UI

**OPEN QUESTION:** management endpoints exist but no member-management UI was found.

## State

Workspace membership role in `project_db`.

## API Usage

See [workspaces API](../api/workspaces.md).

## Validation

Allowed roles: `OWNER`, `ADMIN`, `MEMBER`.

## Authorization

See [permissions matrix](../reference/permissions-matrix.md).

## Error Handling

Last-owner and unauthorized-owner mutations are rejected.

## Important Components / Modules

Project `WorkspaceAccess` and membership use cases; Issue Project access HTTP client.

## Tests

Project domain tests cover project-management role predicate, not the complete membership matrix.

## Known Limitations

IAM `MEMBER` role and workspace membership roles are separate.

## Open Questions

No invitation/identity lookup flow is implemented; caller supplies target user UUID.
