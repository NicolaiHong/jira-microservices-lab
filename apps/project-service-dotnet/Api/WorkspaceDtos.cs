namespace ProjectService.Api;

public sealed record CreateWorkspaceRequest(string? Name, string? Slug);

public sealed record CreateWorkspaceResponse(WorkspaceResponse Workspace);

public sealed record WorkspaceResponse(
    Guid Id,
    string Name,
    string Slug,
    Guid OwnerUserId,
    DateTimeOffset CreatedAt);

public sealed record ListUserWorkspacesResponse(
    IReadOnlyList<UserWorkspaceResponse> Items);

public sealed record UserWorkspaceResponse(
    Guid Id,
    string Name,
    string Slug,
    string Role,
    DateTimeOffset CreatedAt);
