using ProjectService.Api.Mappers;
using ProjectService.Application;
using ProjectService.Application.UseCases;

namespace ProjectService.Api;

public static class ProjectEndpoints
{
    public static IEndpointRouteBuilder MapInternalProjectEndpoints(
        this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/internal");

        group.MapPost("/workspaces", CreateWorkspaceAsync);
        group.MapGet("/workspaces", ListUserWorkspacesAsync);
        group.MapPost("/workspaces/{workspaceId}/members", AddWorkspaceMemberAsync);
        group.MapPatch("/workspaces/{workspaceId}/members/{userId}", ChangeWorkspaceMemberRoleAsync);
        group.MapDelete("/workspaces/{workspaceId}/members/{userId}", RemoveWorkspaceMemberAsync);
        group.MapPost("/workspaces/{workspaceId}/projects", CreateProjectAsync);
        group.MapGet("/workspaces/{workspaceId}/projects", ListProjectsAsync);
        group.MapGet("/projects/{projectId}", GetProjectAsync);
        group.MapPatch("/projects/{projectId}", UpdateProjectAsync);
        group.MapDelete("/projects/{projectId}", ArchiveProjectAsync);
        group.MapGet("/projects/{projectId}/access-context", GetProjectAccessContextAsync);

        return app;
    }

    private static async Task<IResult> CreateWorkspaceAsync(
        CreateWorkspaceRequest? request,
        HttpContext httpContext,
        CreateWorkspaceUseCase useCase,
        CancellationToken cancellationToken)
    {
        var authContext = AuthContext.FromHttpContext(httpContext);
        var result = await useCase.ExecuteAsync(
            ProjectDtoMapper.ToCommand(request),
            authContext.UserId,
            cancellationToken);
        var response = ProjectDtoMapper.ToResponse(result);

        return Results.Created(
            $"/internal/workspaces/{response.Workspace.Id}",
            response);
    }

    private static async Task<IResult> ListUserWorkspacesAsync(
        HttpContext httpContext,
        ListUserWorkspacesUseCase useCase,
        CancellationToken cancellationToken)
    {
        var authContext = AuthContext.FromHttpContext(httpContext);
        var result = await useCase.ExecuteAsync(
            authContext.UserId,
            cancellationToken);
        var response = ProjectDtoMapper.ToResponse(result);

        return Results.Ok(response);
    }

    private static async Task<IResult> CreateProjectAsync(
        string workspaceId,
        CreateProjectRequest? request,
        HttpContext httpContext,
        CreateProjectUseCase useCase,
        CancellationToken cancellationToken)
    {
        var parsedWorkspaceId = RequestValidation.ParseUuid(
            workspaceId,
            "workspaceId");
        var authContext = AuthContext.FromHttpContext(httpContext);
        var result = await useCase.ExecuteAsync(
            parsedWorkspaceId,
            ProjectDtoMapper.ToCommand(request),
            authContext.UserId,
            cancellationToken);
        var response = ProjectDtoMapper.ToResponse(result);

        return Results.Created(
            $"/internal/workspaces/{response.Project.WorkspaceId}/projects/{response.Project.Id}",
            response);
    }

    private static async Task<IResult> AddWorkspaceMemberAsync(
        string workspaceId,
        AddWorkspaceMemberRequest? request,
        HttpContext httpContext,
        AddWorkspaceMemberUseCase useCase,
        CancellationToken cancellationToken)
    {
        var parsedWorkspaceId = RequestValidation.ParseUuid(workspaceId, "workspaceId");
        var actor = AuthContext.FromHttpContext(httpContext);
        var result = await useCase.ExecuteAsync(
            parsedWorkspaceId,
            ProjectDtoMapper.ToCommand(request),
            actor.UserId,
            cancellationToken);

        return Results.Created(
            $"/internal/workspaces/{parsedWorkspaceId}/members/{result.Member.UserId}",
            ProjectDtoMapper.ToResponse(result));
    }

    private static async Task<IResult> ChangeWorkspaceMemberRoleAsync(
        string workspaceId,
        string userId,
        ChangeWorkspaceMemberRoleRequest? request,
        HttpContext httpContext,
        ChangeWorkspaceMemberRoleUseCase useCase,
        CancellationToken cancellationToken)
    {
        var parsedWorkspaceId = RequestValidation.ParseUuid(workspaceId, "workspaceId");
        var parsedUserId = RequestValidation.ParseUuid(userId, "userId");
        var actor = AuthContext.FromHttpContext(httpContext);
        var result = await useCase.ExecuteAsync(
            parsedWorkspaceId,
            parsedUserId,
            ProjectDtoMapper.ToCommand(request),
            actor.UserId,
            cancellationToken);

        return Results.Ok(ProjectDtoMapper.ToResponse(result));
    }

    private static async Task<IResult> RemoveWorkspaceMemberAsync(
        string workspaceId,
        string userId,
        HttpContext httpContext,
        RemoveWorkspaceMemberUseCase useCase,
        CancellationToken cancellationToken)
    {
        var parsedWorkspaceId = RequestValidation.ParseUuid(workspaceId, "workspaceId");
        var parsedUserId = RequestValidation.ParseUuid(userId, "userId");
        var actor = AuthContext.FromHttpContext(httpContext);
        await useCase.ExecuteAsync(
            parsedWorkspaceId,
            parsedUserId,
            actor.UserId,
            cancellationToken);

        return Results.NoContent();
    }

    private static async Task<IResult> ListProjectsAsync(
        string workspaceId,
        HttpContext httpContext,
        ListProjectsUseCase useCase,
        CancellationToken cancellationToken)
    {
        var parsedWorkspaceId = RequestValidation.ParseUuid(workspaceId, "workspaceId");
        var actor = AuthContext.FromHttpContext(httpContext);
        var result = await useCase.ExecuteAsync(
            parsedWorkspaceId, actor.UserId, cancellationToken);

        return Results.Ok(ProjectDtoMapper.ToResponse(result));
    }

    private static async Task<IResult> GetProjectAsync(
        string projectId,
        HttpContext httpContext,
        GetProjectUseCase useCase,
        CancellationToken cancellationToken)
    {
        var parsedProjectId = RequestValidation.ParseUuid(projectId, "projectId");
        var actor = AuthContext.FromHttpContext(httpContext);
        var result = await useCase.ExecuteAsync(
            parsedProjectId, actor.UserId, cancellationToken);

        return Results.Ok(ProjectDtoMapper.ToResponse(result));
    }

    private static async Task<IResult> UpdateProjectAsync(
        string projectId,
        UpdateProjectRequest? request,
        HttpContext httpContext,
        UpdateProjectUseCase useCase,
        CancellationToken cancellationToken)
    {
        var parsedProjectId = RequestValidation.ParseUuid(projectId, "projectId");
        var actor = AuthContext.FromHttpContext(httpContext);
        var result = await useCase.ExecuteAsync(
            parsedProjectId,
            ProjectDtoMapper.ToCommand(request),
            actor.UserId,
            cancellationToken);

        return Results.Ok(ProjectDtoMapper.ToResponse(result));
    }

    private static async Task<IResult> ArchiveProjectAsync(
        string projectId,
        HttpContext httpContext,
        ArchiveProjectUseCase useCase,
        CancellationToken cancellationToken)
    {
        var parsedProjectId = RequestValidation.ParseUuid(projectId, "projectId");
        var actor = AuthContext.FromHttpContext(httpContext);
        await useCase.ExecuteAsync(parsedProjectId, actor.UserId, cancellationToken);

        return Results.NoContent();
    }

    private static async Task<IResult> GetProjectAccessContextAsync(
        string projectId,
        HttpContext httpContext,
        GetProjectAccessContextUseCase useCase,
        CancellationToken cancellationToken)
    {
        var parsedProjectId = RequestValidation.ParseUuid(projectId, "projectId");
        var actor = AuthContext.FromHttpContext(httpContext);
        var result = await useCase.ExecuteAsync(
            parsedProjectId, actor.UserId, cancellationToken);

        return Results.Ok(ProjectDtoMapper.ToResponse(result));
    }
}
