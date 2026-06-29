using Microsoft.EntityFrameworkCore;
using ProjectService.Domain;
using ProjectService.Domain.Repositories;

namespace ProjectService.Infrastructure.Data.Repositories;

public sealed class EfWorkspaceMemberRepository(ProjectDbContext dbContext)
    : IWorkspaceMemberRepository
{
    public Task<WorkspaceMember?> FindMembershipAsync(
        Guid workspaceId,
        Guid userId,
        CancellationToken cancellationToken) =>
        dbContext.WorkspaceMembers
            .AsNoTracking()
            .FirstOrDefaultAsync(
                member => member.WorkspaceId == workspaceId &&
                          member.UserId == userId,
                cancellationToken);

    public async Task<IReadOnlyList<WorkspaceMember>> ListByUserIdAsync(
        Guid userId,
        CancellationToken cancellationToken) =>
        await dbContext.WorkspaceMembers
            .AsNoTracking()
            .Where(member => member.UserId == userId)
            .ToListAsync(cancellationToken);

    public async Task AddAsync(
        WorkspaceMember member,
        CancellationToken cancellationToken)
    {
        await dbContext.WorkspaceMembers.AddAsync(member, cancellationToken);
    }
}
