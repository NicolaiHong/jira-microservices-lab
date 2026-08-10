namespace ProjectService.Application.DTOs;

public sealed record CreateWorkspaceCommand(string? Name, string? Slug);

public sealed record CreateWorkspaceResult(WorkspaceResult Workspace);

public sealed record WorkspaceResult(
    Guid Id,
    string Name,
    string Slug,
    Guid OwnerUserId,
    DateTimeOffset CreatedAt);

public sealed record ListUserWorkspacesResult(
    IReadOnlyList<UserWorkspaceResult> Items);

public sealed record UserWorkspaceResult(
    Guid Id,
    string Name,
    string Slug,
    string Role,
    DateTimeOffset CreatedAt);

public sealed record AddWorkspaceMemberCommand(
    Guid? UserId,
    string? Role);

public sealed record ChangeWorkspaceMemberRoleCommand(string? Role);

public sealed record WorkspaceMemberResult(
    Guid UserId,
    string Role,
    DateTimeOffset JoinedAt,
    DateTimeOffset UpdatedAt);

public sealed record AddWorkspaceMemberResult(WorkspaceMemberResult Member);

public sealed record ChangeWorkspaceMemberRoleResult(WorkspaceMemberResult Member);
