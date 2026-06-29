using Microsoft.EntityFrameworkCore;
using Npgsql;
using ProjectService.Domain;
using ProjectService.Domain.Exceptions;
using ProjectService.Domain.Repositories;

namespace ProjectService.Infrastructure.Data.Repositories;

public sealed class EfProjectRepository(ProjectDbContext dbContext)
    : IProjectRepository
{
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
                       project.Name == name,
            cancellationToken);

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
            throw new DomainException(
                409,
                ProjectErrorCodes.ProjectKeyAlreadyExists,
                "Project key already exists inside this workspace");
        }
        catch (DbUpdateException exception) when (IsUniqueViolation(exception, "ux_projects_workspace_id_name"))
        {
            throw new DomainException(
                409,
                ProjectErrorCodes.ProjectNameAlreadyExists,
                "Project name already exists inside this workspace");
        }
    }

    private static bool IsUniqueViolation(
        DbUpdateException exception,
        string constraintName) =>
        exception.InnerException is PostgresException postgresException &&
        postgresException.SqlState == PostgresErrorCodes.UniqueViolation &&
        postgresException.ConstraintName == constraintName;
}
