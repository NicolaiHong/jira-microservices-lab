namespace ProjectService.Application.DTOs;

public sealed record CreateProjectCommand(
    string? Name,
    string? Key,
    string? Description);

public sealed record CreateProjectResult(ProjectResult Project);

public sealed record ListProjectsResult(IReadOnlyList<ProjectResult> Items);

public sealed record UpdateProjectCommand(
    string? Name,
    string? Description);

public sealed record UpdateProjectResult(ProjectResult Project);

public sealed record ProjectAccessContextResult(
    Guid ProjectId,
    Guid WorkspaceId,
    string ProjectKey,
    string ProjectStatus,
    string MembershipRole);

public sealed record ProjectResult(
    Guid Id,
    Guid WorkspaceId,
    string Name,
    string Key,
    string? Description,
    string Status,
    Guid CreatedByUserId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
