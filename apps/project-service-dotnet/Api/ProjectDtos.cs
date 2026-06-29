namespace ProjectService.Api;

public sealed record CreateProjectRequest(
    string? Name,
    string? Key,
    string? Description);

public sealed record CreateProjectResponse(ProjectResponse Project);

public sealed record ProjectResponse(
    Guid Id,
    Guid WorkspaceId,
    string Name,
    string Key,
    string? Description,
    Guid CreatedByUserId,
    DateTimeOffset CreatedAt);
