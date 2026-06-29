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
