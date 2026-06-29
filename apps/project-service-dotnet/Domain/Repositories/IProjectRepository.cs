namespace ProjectService.Domain.Repositories;

public interface IProjectRepository
{
    Task<bool> AnyByKeyAsync(
        Guid workspaceId,
        string key,
        CancellationToken cancellationToken);

    Task<bool> AnyByNameAsync(
        Guid workspaceId,
        string name,
        CancellationToken cancellationToken);

    Task AddAsync(
        Project project,
        CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
