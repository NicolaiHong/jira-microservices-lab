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
        group.MapPost("/workspaces/{workspaceId}/projects", CreateProjectAsync);

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
}
