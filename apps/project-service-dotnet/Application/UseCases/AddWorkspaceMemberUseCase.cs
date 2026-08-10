using ProjectService.Application.DTOs;
using ProjectService.Domain;
using ProjectService.Domain.Exceptions;
using ProjectService.Domain.Repositories;

namespace ProjectService.Application.UseCases;

public sealed class AddWorkspaceMemberUseCase(
    IWorkspaceMemberRepository memberRepository)
{
    public async Task<AddWorkspaceMemberResult> ExecuteAsync(
        Guid workspaceId,
        AddWorkspaceMemberCommand? command,
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

        var userId = RequestValidation.RequiredUuid(command.UserId, "userId");
        var role = RequestValidation.NormalizeWorkspaceRole(command.Role);
        WorkspaceAccess.RequireOwnerForOwnerRole(actor, role);

        if (await memberRepository.FindMembershipAsync(
                workspaceId, userId, cancellationToken) is not null)
        {
            throw new DomainException(
                409,
                ProjectErrorCodes.WorkspaceMemberAlreadyExists,
                "User is already a workspace member");
        }

        var now = DateTimeOffset.UtcNow;
        var member = new WorkspaceMember
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            UserId = userId,
            Role = role,
            JoinedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };

        await memberRepository.AddAsync(member, cancellationToken);
        await memberRepository.SaveChangesAsync(cancellationToken);

        return new AddWorkspaceMemberResult(ToResult(member));
    }

    private static WorkspaceMemberResult ToResult(WorkspaceMember member) =>
        new(member.UserId, member.Role, member.JoinedAt, member.UpdatedAt);
}
