using ProjectService.Application.DTOs;
using ProjectService.Domain.Repositories;

namespace ProjectService.Application.UseCases;

public sealed class ListWorkspaceMembersUseCase(
    IWorkspaceMemberRepository memberRepository,
    IUserDirectory userDirectory)
{
    public async Task<ListWorkspaceMembersResult> ExecuteAsync(
        Guid workspaceId,
        Guid authenticatedUserId,
        CancellationToken cancellationToken)
    {
        await WorkspaceAccess.RequireMembershipAsync(
            memberRepository, workspaceId, authenticatedUserId, cancellationToken);

        var members = await memberRepository.ListByWorkspaceIdAsync(
            workspaceId, cancellationToken);
        var emails = (await userDirectory.LookupAsync(
                members.Select(member => member.UserId).ToList(),
                [],
                cancellationToken))
            .ToDictionary(user => user.Id, user => user.Email);

        return new ListWorkspaceMembersResult(members
            .Select(member => new WorkspaceMemberListItemResult(
                member.UserId,
                emails.GetValueOrDefault(member.UserId),
                member.Role,
                member.JoinedAt,
                member.UpdatedAt))
            .ToList());
    }
}
