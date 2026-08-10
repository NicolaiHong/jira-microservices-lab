using ProjectService.Application.DTOs;
using ProjectService.Domain.Repositories;

namespace ProjectService.Application.UseCases;

public sealed class GetProjectAccessContextUseCase(
    IProjectRepository projectRepository,
    IWorkspaceMemberRepository memberRepository)
{
    public async Task<ProjectAccessContextResult> ExecuteAsync(
        Guid projectId,
        Guid authenticatedUserId,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.FindByIdAsync(
            projectId, cancellationToken) ?? throw WorkspaceAccess.ProjectNotFound();
        var membership = await memberRepository.FindMembershipAsync(
            project.WorkspaceId, authenticatedUserId, cancellationToken);
        if (membership is null)
        {
            throw WorkspaceAccess.ProjectNotFound();
        }

        return new ProjectAccessContextResult(
            project.Id,
            project.WorkspaceId,
            project.Key,
            project.Status,
            membership.Role);
    }
}
