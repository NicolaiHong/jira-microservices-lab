using ProjectService.Application.DTOs;
using ProjectService.Domain;

namespace ProjectService.Application;

internal static class ProjectResultMapper
{
    public static ProjectResult ToResult(Project project) =>
        new(
            project.Id,
            project.WorkspaceId,
            project.Name,
            project.Key,
            project.Description,
            project.Status,
            project.CreatedByUserId,
            project.CreatedAt,
            project.UpdatedAt);
}
