using ProjectService.Domain;
using ProjectService.Domain.Exceptions;
using ProjectService.Domain.Repositories;

namespace ProjectService.Application.UseCases;

public sealed class RemoveWorkspaceMemberUseCase(
    IWorkspaceMemberRepository memberRepository)
{
    public async Task ExecuteAsync(
        Guid workspaceId,
        Guid targetUserId,
        Guid authenticatedUserId,
        CancellationToken cancellationToken)
    {
        var actor = await WorkspaceAccess.RequireMembershipAsync(
            memberRepository, workspaceId, authenticatedUserId, cancellationToken);
        WorkspaceAccess.RequireMemberManager(actor);

        var target = await memberRepository.FindMembershipAsync(
            workspaceId, targetUserId, cancellationToken) ?? throw MemberNotFound();
        WorkspaceAccess.RequireOwnerForOwnerRole(actor, target.Role);

        if (target.Role == WorkspaceRoles.Owner &&
            await memberRepository.CountOwnersAsync(workspaceId, cancellationToken) <= 1)
        {
            throw new DomainException(
                409,
                ProjectErrorCodes.LastWorkspaceOwner,
                "A workspace must keep at least one owner");
        }

        memberRepository.Remove(target);
        await memberRepository.SaveChangesAsync(cancellationToken);
    }

    private static DomainException MemberNotFound() =>
        new(404, ProjectErrorCodes.WorkspaceMemberNotFound, "Workspace member was not found");
}
