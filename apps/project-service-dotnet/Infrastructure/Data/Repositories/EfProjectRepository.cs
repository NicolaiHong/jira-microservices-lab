using Microsoft.EntityFrameworkCore;
using Npgsql;
using ProjectService.Domain;
using ProjectService.Domain.Exceptions;
using ProjectService.Domain.Repositories;

namespace ProjectService.Infrastructure.Data.Repositories;

public sealed class EfProjectRepository(ProjectDbContext dbContext)
    : IProjectRepository
{
    public Task<Project?> FindByIdAsync(
        Guid projectId,
        CancellationToken cancellationToken) =>
        dbContext.Projects.AsNoTracking().FirstOrDefaultAsync(
            project => project.Id == projectId,
            cancellationToken);

    public async Task<IReadOnlyList<Project>> ListByWorkspaceIdAsync(
        Guid workspaceId,
        CancellationToken cancellationToken) =>
        await dbContext.Projects
            .AsNoTracking()
            .Where(project => project.WorkspaceId == workspaceId)
            .OrderBy(project => project.Name)
            .ToListAsync(cancellationToken);

    public Task<bool> AnyByKeyAsync(
        Guid workspaceId,
        string key,
        CancellationToken cancellationToken) =>
        dbContext.Projects.AnyAsync(
            project => project.WorkspaceId == workspaceId &&
                       project.Key == key,
            cancellationToken);

    public Task<bool> AnyByNameAsync(
        Guid workspaceId,
        string name,
        CancellationToken cancellationToken) =>
        dbContext.Projects.AnyAsync(
            project => project.WorkspaceId == workspaceId &&
                       project.Name.ToLower() == name.ToLowerInvariant(),
            cancellationToken);

    public async Task<bool> UpdateActiveAsync(
        Guid projectId,
        string name,
        string? description,
        DateTimeOffset updatedAt,
        CancellationToken cancellationToken)
    {
        try
        {
            var affected = await dbContext.Projects
                .Where(project =>
                    project.Id == projectId &&
                    project.Status == ProjectStatuses.Active)
                .ExecuteUpdateAsync(updates => updates
                    .SetProperty(project => project.Name, name)
                    .SetProperty(project => project.Description, description)
                    .SetProperty(project => project.UpdatedAt, updatedAt),
                    cancellationToken);

            return affected == 1;
        }
        catch (PostgresException exception) when (IsUniqueViolation(
                   exception,
                   "ux_projects_workspace_id_lower_name"))
        {
            throw ProjectNameAlreadyExists();
        }
    }

    public async Task<bool> ArchiveActiveAsync(
        Guid projectId,
        DateTimeOffset archivedAt,
        CancellationToken cancellationToken)
    {
        var affected = await dbContext.Projects
            .Where(project =>
                project.Id == projectId &&
                project.Status == ProjectStatuses.Active)
            .ExecuteUpdateAsync(updates => updates
                .SetProperty(project => project.Status, ProjectStatuses.Archived)
                .SetProperty(project => project.UpdatedAt, archivedAt),
                cancellationToken);

        return affected == 1;
    }

    public async Task AddAsync(
        Project project,
        CancellationToken cancellationToken)
    {
        await dbContext.Projects.AddAsync(project, cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsUniqueViolation(exception, "ux_projects_workspace_id_key"))
        {
            throw ProjectKeyAlreadyExists();
        }
        catch (DbUpdateException exception) when (IsUniqueViolation(exception, "ux_projects_workspace_id_lower_name"))
        {
            throw ProjectNameAlreadyExists();
        }
    }

    private static DomainException ProjectKeyAlreadyExists() =>
        new(
            409,
            ProjectErrorCodes.ProjectKeyAlreadyExists,
            "Project key already exists inside this workspace");

    private static DomainException ProjectNameAlreadyExists() =>
        new(
            409,
            ProjectErrorCodes.ProjectNameAlreadyExists,
            "Project name already exists inside this workspace");

    private static bool IsUniqueViolation(
        DbUpdateException exception,
        string constraintName) =>
        exception.InnerException is PostgresException postgresException &&
        IsUniqueViolation(postgresException, constraintName);

    private static bool IsUniqueViolation(
        PostgresException exception,
        string constraintName) =>
        exception.SqlState == PostgresErrorCodes.UniqueViolation &&
        exception.ConstraintName == constraintName;
}
