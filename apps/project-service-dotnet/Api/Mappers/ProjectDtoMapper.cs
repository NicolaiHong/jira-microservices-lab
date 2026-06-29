using AppDtos = ProjectService.Application.DTOs;

namespace ProjectService.Api.Mappers;

public static class ProjectDtoMapper
{
    public static AppDtos.CreateWorkspaceCommand? ToCommand(
        CreateWorkspaceRequest? request) =>
        request is null
            ? null
            : new AppDtos.CreateWorkspaceCommand(
                request.Name,
                request.Slug);

    public static CreateWorkspaceResponse ToResponse(
        AppDtos.CreateWorkspaceResult result) =>
        new(
            new WorkspaceResponse(
                result.Workspace.Id,
                result.Workspace.Name,
                result.Workspace.Slug,
                result.Workspace.OwnerUserId,
                result.Workspace.CreatedAt));

    public static ListUserWorkspacesResponse ToResponse(
        AppDtos.ListUserWorkspacesResult result) =>
        new(
            result.Items
                .Select(workspace => new UserWorkspaceResponse(
                    workspace.Id,
                    workspace.Name,
                    workspace.Slug,
                    workspace.Role,
                    workspace.CreatedAt))
                .ToList());

    public static AppDtos.CreateProjectCommand? ToCommand(
        CreateProjectRequest? request) =>
        request is null
            ? null
            : new AppDtos.CreateProjectCommand(
                request.Name,
                request.Key,
                request.Description);

    public static CreateProjectResponse ToResponse(
        AppDtos.CreateProjectResult result) =>
        new(
            new ProjectResponse(
                result.Project.Id,
                result.Project.WorkspaceId,
                result.Project.Name,
                result.Project.Key,
                result.Project.Description,
                result.Project.CreatedByUserId,
                result.Project.CreatedAt));
}
