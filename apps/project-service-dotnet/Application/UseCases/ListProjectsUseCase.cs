using ProjectService.Application.DTOs;
using ProjectService.Domain.Repositories;

namespace ProjectService.Application.UseCases;

public sealed class ListProjectsUseCase(
    IProjectRepository projectRepository,
    IWorkspaceMemberRepository memberRepository)
{
    public async Task<ListProjectsResult> ExecuteAsync(
        Guid workspaceId,
        Guid authenticatedUserId,
        CancellationToken cancellationToken)
    {
        await WorkspaceAccess.RequireMembershipAsync(
            memberRepository, workspaceId, authenticatedUserId, cancellationToken);
        var projects = await projectRepository.ListByWorkspaceIdAsync(
            workspaceId, cancellationToken);

        return new ListProjectsResult(
            projects.Select(ProjectResultMapper.ToResult).ToList());
    }
}
