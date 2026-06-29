using ProjectService.Application;

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
        ProjectApplicationService service,
        CancellationToken cancellationToken)
    {
        var authContext = AuthContext.FromHttpContext(httpContext);
        var response = await service.CreateWorkspaceAsync(
            request,
            authContext.UserId,
            cancellationToken);

        return Results.Created(
            $"/internal/workspaces/{response.Workspace.Id}",
            response);
    }

    private static async Task<IResult> ListUserWorkspacesAsync(
        HttpContext httpContext,
        ProjectApplicationService service,
        CancellationToken cancellationToken)
    {
        var authContext = AuthContext.FromHttpContext(httpContext);
        var response = await service.ListUserWorkspacesAsync(
            authContext.UserId,
            cancellationToken);

        return Results.Ok(response);
    }

    private static async Task<IResult> CreateProjectAsync(
        string workspaceId,
        CreateProjectRequest? request,
        HttpContext httpContext,
        ProjectApplicationService service,
        CancellationToken cancellationToken)
    {
        var parsedWorkspaceId = RequestValidation.ParseUuid(
            workspaceId,
            "workspaceId");
        var authContext = AuthContext.FromHttpContext(httpContext);
        var response = await service.CreateProjectAsync(
            parsedWorkspaceId,
            request,
            authContext.UserId,
            cancellationToken);

        return Results.Created(
            $"/internal/workspaces/{response.Project.WorkspaceId}/projects/{response.Project.Id}",
            response);
    }
}
