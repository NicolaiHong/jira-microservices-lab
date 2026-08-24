using ProjectService.Domain.Repositories;

namespace ProjectService.Application.UseCases;

public sealed class ArchiveProjectUseCase(
    IProjectRepository projectRepository,
    IWorkspaceMemberRepository memberRepository)
{
    public async Task ExecuteAsync(
        Guid projectId,
        Guid authenticatedUserId,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.FindByIdAsync(
            projectId, cancellationToken) ?? throw WorkspaceAccess.ProjectNotFound();
        var actor = await memberRepository.FindMembershipAsync(
            project.WorkspaceId, authenticatedUserId, cancellationToken);
        if (actor is null)
        {
            throw WorkspaceAccess.ProjectNotFound();
        }

        WorkspaceAccess.RequireProjectManager(actor);
        await projectRepository.ArchiveActiveAsync(
            project.Id,
            PostgresTimestamp.UtcNow(),
            cancellationToken);
    }
}
