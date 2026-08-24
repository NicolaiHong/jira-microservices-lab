using Microsoft.EntityFrameworkCore;
using Npgsql;
using ProjectService.Domain;
using ProjectService.Domain.Exceptions;
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

    public Task<int> CountOwnersAsync(
        Guid workspaceId,
        CancellationToken cancellationToken) =>
        dbContext.WorkspaceMembers.CountAsync(
            member => member.WorkspaceId == workspaceId &&
                      member.Role == WorkspaceRoles.Owner,
            cancellationToken);

    public async Task AddAsync(
        WorkspaceMember member,
        CancellationToken cancellationToken)
    {
        await dbContext.WorkspaceMembers.AddAsync(member, cancellationToken);
    }

    public void Remove(WorkspaceMember member)
    {
        dbContext.WorkspaceMembers.Remove(member);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsUniqueViolation(
                   exception,
                   "ux_workspace_members_workspace_id_user_id"))
        {
            throw DuplicateMember();
        }
        catch (PostgresException exception) when (IsUniqueViolation(
                   exception,
                   "ux_workspace_members_workspace_id_user_id"))
        {
            throw DuplicateMember();
        }
        catch (DbUpdateException exception) when (IsCheckViolation(
                   exception,
                   "ck_workspace_members_at_least_one_owner"))
        {
            throw LastOwner();
        }
        catch (PostgresException exception) when (IsCheckViolation(
                   exception,
                   "ck_workspace_members_at_least_one_owner"))
        {
            throw LastOwner();
        }
    }

    private static DomainException DuplicateMember() =>
        new(
            409,
            ProjectErrorCodes.WorkspaceMemberAlreadyExists,
            "User is already a workspace member");

    private static DomainException LastOwner() =>
        new(
            409,
            ProjectErrorCodes.LastWorkspaceOwner,
            "A workspace must keep at least one owner");

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

    private static bool IsCheckViolation(
        DbUpdateException exception,
        string constraintName) =>
        exception.InnerException is PostgresException postgresException &&
        IsCheckViolation(postgresException, constraintName);

    private static bool IsCheckViolation(
        PostgresException exception,
        string constraintName) =>
        exception.SqlState == PostgresErrorCodes.CheckViolation &&
        exception.ConstraintName == constraintName;
}
