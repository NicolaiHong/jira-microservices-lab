namespace ProjectService.Domain.Repositories;

public interface IWorkspaceRepository
{
    Task<bool> AnyBySlugAsync(
        string slug,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<Workspace>> ListByIdsAsync(
        IReadOnlyCollection<Guid> workspaceIds,
        CancellationToken cancellationToken);

    Task AddAsync(
        Workspace workspace,
        CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
