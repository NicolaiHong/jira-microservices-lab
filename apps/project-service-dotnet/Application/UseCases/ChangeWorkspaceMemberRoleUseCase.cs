using ProjectService.Application.DTOs;
using ProjectService.Domain;
using ProjectService.Domain.Exceptions;
using ProjectService.Domain.Repositories;

namespace ProjectService.Application.UseCases;

public sealed class ChangeWorkspaceMemberRoleUseCase(
    IWorkspaceMemberRepository memberRepository)
{
    public async Task<ChangeWorkspaceMemberRoleResult> ExecuteAsync(
        Guid workspaceId,
        Guid targetUserId,
        ChangeWorkspaceMemberRoleCommand? command,
        Guid authenticatedUserId,
        CancellationToken cancellationToken)
    {
        if (command is null)
        {
            throw RequestValidation.ValidationError("body", "Request body is required");
        }

        var actor = await WorkspaceAccess.RequireMembershipAsync(
            memberRepository, workspaceId, authenticatedUserId, cancellationToken);
        WorkspaceAccess.RequireMemberManager(actor);

        var target = await memberRepository.FindMembershipAsync(
            workspaceId, targetUserId, cancellationToken) ?? throw MemberNotFound();
        var role = RequestValidation.NormalizeWorkspaceRole(command.Role);

        WorkspaceAccess.RequireOwnerForOwnerRole(actor, target.Role);
        WorkspaceAccess.RequireOwnerForOwnerRole(actor, role);

        if (target.Role == WorkspaceRoles.Owner &&
            role != WorkspaceRoles.Owner &&
            await memberRepository.CountOwnersAsync(workspaceId, cancellationToken) <= 1)
        {
            throw LastOwner();
        }

        target.Role = role;
        target.UpdatedAt = DateTimeOffset.UtcNow;
        await memberRepository.SaveChangesAsync(cancellationToken);

        return new ChangeWorkspaceMemberRoleResult(
            new WorkspaceMemberResult(
                target.UserId,
                target.Role,
                target.JoinedAt,
                target.UpdatedAt));
    }

    private static DomainException MemberNotFound() =>
        new(404, ProjectErrorCodes.WorkspaceMemberNotFound, "Workspace member was not found");

    private static DomainException LastOwner() =>
        new(409, ProjectErrorCodes.LastWorkspaceOwner, "A workspace must keep at least one owner");
}
