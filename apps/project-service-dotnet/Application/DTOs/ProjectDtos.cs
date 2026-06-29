namespace ProjectService.Application.DTOs;

public sealed record CreateProjectCommand(
    string? Name,
    string? Key,
    string? Description);

public sealed record CreateProjectResult(ProjectResult Project);

public sealed record ProjectResult(
    Guid Id,
    Guid WorkspaceId,
    string Name,
    string Key,
    string? Description,
    Guid CreatedByUserId,
    DateTimeOffset CreatedAt);
