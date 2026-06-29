using Microsoft.EntityFrameworkCore;
using Npgsql;
using ProjectService.Domain;
using ProjectService.Domain.Exceptions;
using ProjectService.Domain.Repositories;

namespace ProjectService.Infrastructure.Data.Repositories;

public sealed class EfWorkspaceRepository(ProjectDbContext dbContext)
    : IWorkspaceRepository
{
    public Task<bool> AnyBySlugAsync(
        string slug,
        CancellationToken cancellationToken) =>
        dbContext.Workspaces.AnyAsync(
            workspace => workspace.Slug == slug,
            cancellationToken);

    public async Task<IReadOnlyList<Workspace>> ListByIdsAsync(
        IReadOnlyCollection<Guid> workspaceIds,
        CancellationToken cancellationToken)
    {
        if (workspaceIds.Count == 0)
        {
            return Array.Empty<Workspace>();
        }

        var ids = workspaceIds.Distinct().ToArray();
        return await dbContext.Workspaces
            .AsNoTracking()
            .Where(workspace => ids.Contains(workspace.Id))
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(
        Workspace workspace,
        CancellationToken cancellationToken)
    {
        await dbContext.Workspaces.AddAsync(workspace, cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsUniqueViolation(exception, "ux_workspaces_slug"))
        {
            throw new DomainException(
                409,
                ProjectErrorCodes.WorkspaceSlugAlreadyExists,
                "Workspace slug already exists");
        }
    }

    private static bool IsUniqueViolation(
        DbUpdateException exception,
        string constraintName) =>
        exception.InnerException is PostgresException postgresException &&
        postgresException.SqlState == PostgresErrorCodes.UniqueViolation &&
        postgresException.ConstraintName == constraintName;
}
