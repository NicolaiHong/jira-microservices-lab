using Microsoft.EntityFrameworkCore;
using Npgsql;
using ProjectService.Api;
using ProjectService.Domain;
using ProjectService.Infrastructure.Data;

namespace ProjectService.Application;

public sealed class ProjectApplicationService(ProjectDbContext dbContext)
{
    public async Task<CreateWorkspaceResponse> CreateWorkspaceAsync(
        CreateWorkspaceRequest? request,
        Guid authenticatedUserId,
        CancellationToken cancellationToken)
    {
        if (request is null)
        {
            throw RequestValidation.ValidationError("body", "Request body is required");
        }

        var name = RequestValidation.RequiredString(request.Name, "name", 120);
        var slug = RequestValidation.NormalizeSlug(request.Slug);

        if (await dbContext.Workspaces.AnyAsync(
                workspace => workspace.Slug == slug,
                cancellationToken))
        {
            throw WorkspaceSlugAlreadyExists();
        }

        var now = DateTimeOffset.UtcNow;
        var workspace = new Workspace
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = slug,
            OwnerUserId = authenticatedUserId,
            CreatedAt = now,
            UpdatedAt = now
        };
        var ownerMembership = new WorkspaceMember
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspace.Id,
            UserId = authenticatedUserId,
            Role = WorkspaceRoles.Owner,
            JoinedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        dbContext.Workspaces.Add(workspace);
        dbContext.WorkspaceMembers.Add(ownerMembership);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsUniqueViolation(exception, "ux_workspaces_slug"))
        {
            await transaction.RollbackAsync(cancellationToken);
            throw WorkspaceSlugAlreadyExists();
        }

        return new CreateWorkspaceResponse(
            new WorkspaceResponse(
                workspace.Id,
                workspace.Name,
                workspace.Slug,
                workspace.OwnerUserId,
                workspace.CreatedAt));
    }

    public async Task<ListUserWorkspacesResponse> ListUserWorkspacesAsync(
        Guid authenticatedUserId,
        CancellationToken cancellationToken)
    {
        var items = await dbContext.WorkspaceMembers
            .AsNoTracking()
            .Where(member => member.UserId == authenticatedUserId)
            .Join(
                dbContext.Workspaces.AsNoTracking(),
                member => member.WorkspaceId,
                workspace => workspace.Id,
                (member, workspace) => new UserWorkspaceResponse(
                    workspace.Id,
                    workspace.Name,
                    workspace.Slug,
                    member.Role,
                    workspace.CreatedAt))
            .OrderByDescending(workspace => workspace.CreatedAt)
            .ToListAsync(cancellationToken);

        return new ListUserWorkspacesResponse(items);
    }

    public async Task<CreateProjectResponse> CreateProjectAsync(
        Guid workspaceId,
        CreateProjectRequest? request,
        Guid authenticatedUserId,
        CancellationToken cancellationToken)
    {
        if (request is null)
        {
            throw RequestValidation.ValidationError("body", "Request body is required");
        }

        var membership = await dbContext.WorkspaceMembers
            .AsNoTracking()
            .FirstOrDefaultAsync(
                member => member.WorkspaceId == workspaceId &&
                          member.UserId == authenticatedUserId,
                cancellationToken);

        if (membership is null)
        {
            throw new ProjectApiException(
                StatusCodes.Status404NotFound,
                ProjectErrorCodes.WorkspaceNotFound,
                "Workspace was not found");
        }

        if (!WorkspaceRoles.CanCreateProject(membership.Role))
        {
            throw new ProjectApiException(
                StatusCodes.Status403Forbidden,
                ProjectErrorCodes.WorkspacePermissionDenied,
                "Workspace role is not allowed to create projects");
        }

        var name = RequestValidation.RequiredString(request.Name, "name", 120);
        var key = RequestValidation.NormalizeProjectKey(request.Key);
        var description = RequestValidation.OptionalString(
            request.Description,
            "description",
            2000);

        if (await dbContext.Projects.AnyAsync(
                project => project.WorkspaceId == workspaceId && project.Key == key,
                cancellationToken))
        {
            throw ProjectKeyAlreadyExists();
        }

        if (await dbContext.Projects.AnyAsync(
                project => project.WorkspaceId == workspaceId && project.Name == name,
                cancellationToken))
        {
            throw ProjectNameAlreadyExists();
        }

        var now = DateTimeOffset.UtcNow;
        var project = new Project
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            Name = name,
            Key = key,
            Description = description,
            CreatedByUserId = authenticatedUserId,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Projects.Add(project);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsUniqueViolation(exception, "ux_projects_workspace_id_key"))
        {
            throw ProjectKeyAlreadyExists();
        }
        catch (DbUpdateException exception) when (IsUniqueViolation(exception, "ux_projects_workspace_id_name"))
        {
            throw ProjectNameAlreadyExists();
        }

        return new CreateProjectResponse(
            new ProjectResponse(
                project.Id,
                project.WorkspaceId,
                project.Name,
                project.Key,
                project.Description,
                project.CreatedByUserId,
                project.CreatedAt));
    }

    private static ProjectApiException WorkspaceSlugAlreadyExists() =>
        new(
            StatusCodes.Status409Conflict,
            ProjectErrorCodes.WorkspaceSlugAlreadyExists,
            "Workspace slug already exists");

    private static ProjectApiException ProjectKeyAlreadyExists() =>
        new(
            StatusCodes.Status409Conflict,
            ProjectErrorCodes.ProjectKeyAlreadyExists,
            "Project key already exists inside this workspace");

    private static ProjectApiException ProjectNameAlreadyExists() =>
        new(
            StatusCodes.Status409Conflict,
            ProjectErrorCodes.ProjectNameAlreadyExists,
            "Project name already exists inside this workspace");

    private static bool IsUniqueViolation(
        DbUpdateException exception,
        string constraintName) =>
        exception.InnerException is PostgresException postgresException &&
        postgresException.SqlState == PostgresErrorCodes.UniqueViolation &&
        postgresException.ConstraintName == constraintName;
}
