# Members and Permissions Feature

## Purpose

Workspace role management and authorization context.

## Related Requirements

WS-002.

## Related Business Flows

[Workspace management](../flows/workspace-management.md).

## Responsibilities

Project Service is the authority for workspace roles and access context; Issue consumes that context. IAM supplies member emails to Project Service through an internal lookup ([ADR 0003](../decisions/0003-workspace-member-identity-lookup.md)).

## UI

`WorkspaceMembers` on `/projects` lists members, adds by email, and changes or removes memberships; an `ADMIN` sees no owner-role option and no controls on owner rows. `MemberSelect` provides the assignee picker in issue creation and issue details and labels a no-longer-member assignee as "Former member".

## State

Workspace membership role in `project_db`.

## API Usage

See [workspaces API](../api/workspaces.md).

## Validation

Allowed roles: `OWNER`, `ADMIN`, `MEMBER`.

## Authorization

See [permissions matrix](../reference/permissions-matrix.md).

## Error Handling

Last-owner and unauthorized-owner mutations are rejected. An unregistered email returns `USER_NOT_FOUND`; IAM unavailability returns `IAM_SERVICE_UNAVAILABLE` for listing and email-based addition.

## Important Components / Modules

Project `WorkspaceAccess`, membership use cases, `ListWorkspaceMembersUseCase`, and `IamUserDirectory`; IAM `LookupUsersUseCase`; Gateway member-addition rate limit; Issue Project access HTTP client.

## Tests

Project use-case tests cover the membership matrix, email addition ordering (authorization before IAM lookup), and member listing; `IamUserDirectoryTests` cover IAM failure mapping and request chunking. IAM tests cover lookup normalization, limits, and the identity queries. Web tests cover `WorkspaceMembers` role gating and the assignee picker.

## Known Limitations

IAM `MEMBER` role and workspace membership roles are separate. There is no invitation flow: only already-registered emails can be added. A member manager can learn whether an email is registered by attempting to add it, bounded by the Gateway rate limit.
