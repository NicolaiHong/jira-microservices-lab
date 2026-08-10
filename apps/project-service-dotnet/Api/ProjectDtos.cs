namespace ProjectService.Api;

public sealed record CreateProjectRequest(
    string? Name,
    string? Key,
    string? Description);

public sealed record CreateProjectResponse(ProjectResponse Project);

public sealed record ListProjectsResponse(IReadOnlyList<ProjectResponse> Items);

public sealed record UpdateProjectRequest(
    string? Name,
    string? Description);

public sealed record UpdateProjectResponse(ProjectResponse Project);

public sealed record ProjectAccessContextResponse(
    Guid ProjectId,
    Guid WorkspaceId,
    string ProjectKey,
    string ProjectStatus,
    string MembershipRole);

public sealed record ProjectResponse(
    Guid Id,
    Guid WorkspaceId,
    string Name,
    string Key,
    string? Description,
    string Status,
    Guid CreatedByUserId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
