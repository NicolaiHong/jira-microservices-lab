namespace ProjectService.Domain.Repositories;

public interface IWorkspaceMemberRepository
{
    Task<WorkspaceMember?> FindMembershipAsync(
        Guid workspaceId,
        Guid userId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<WorkspaceMember>> ListByUserIdAsync(
        Guid userId,
        CancellationToken cancellationToken);

    Task AddAsync(
        WorkspaceMember member,
        CancellationToken cancellationToken);
}
