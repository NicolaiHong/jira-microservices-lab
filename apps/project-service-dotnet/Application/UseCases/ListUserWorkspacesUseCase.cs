using ProjectService.Application.DTOs;
using ProjectService.Domain.Repositories;

namespace ProjectService.Application.UseCases;

public sealed class ListUserWorkspacesUseCase(
    IWorkspaceMemberRepository workspaceMemberRepository,
    IWorkspaceRepository workspaceRepository)
{
    public async Task<ListUserWorkspacesResult> ExecuteAsync(
        Guid authenticatedUserId,
        CancellationToken cancellationToken)
    {
        var memberships = await workspaceMemberRepository.ListByUserIdAsync(
            authenticatedUserId,
            cancellationToken);
        var workspaceIds = memberships
            .Select(member => member.WorkspaceId)
            .Distinct()
            .ToArray();
        var workspaces = await workspaceRepository.ListByIdsAsync(
            workspaceIds,
            cancellationToken);
        var workspacesById = workspaces.ToDictionary(workspace => workspace.Id);
        var items = new List<UserWorkspaceResult>();

        foreach (var membership in memberships)
        {
            if (!workspacesById.TryGetValue(membership.WorkspaceId, out var workspace))
            {
                continue;
            }

            items.Add(new UserWorkspaceResult(
                workspace.Id,
                workspace.Name,
                workspace.Slug,
                membership.Role,
                workspace.CreatedAt));
        }

        return new ListUserWorkspacesResult(
            items
                .OrderByDescending(workspace => workspace.CreatedAt)
                .ToList());
    }
}
