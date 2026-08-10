using ProjectService.Application.DTOs;
using ProjectService.Domain;
using ProjectService.Domain.Exceptions;
using ProjectService.Domain.Repositories;

namespace ProjectService.Application.UseCases;

public sealed class UpdateProjectUseCase(
    IProjectRepository projectRepository,
    IWorkspaceMemberRepository memberRepository)
{
    public async Task<UpdateProjectResult> ExecuteAsync(
        Guid projectId,
        UpdateProjectCommand? command,
        Guid authenticatedUserId,
        CancellationToken cancellationToken)
    {
        if (command is null)
        {
            throw RequestValidation.ValidationError("body", "Request body is required");
        }

        var project = await projectRepository.FindByIdAsync(
            projectId, cancellationToken) ?? throw WorkspaceAccess.ProjectNotFound();
        var actor = await memberRepository.FindMembershipAsync(
            project.WorkspaceId, authenticatedUserId, cancellationToken);
        if (actor is null)
        {
            throw WorkspaceAccess.ProjectNotFound();
        }

        WorkspaceAccess.RequireProjectManager(actor);
        var name = RequestValidation.RequiredString(command.Name, "name", 120);
        var description = RequestValidation.OptionalString(
            command.Description, "description", 2000);

        if (!string.Equals(project.Name, name, StringComparison.Ordinal) &&
            await projectRepository.AnyByNameAsync(
                project.WorkspaceId, name, cancellationToken))
        {
            throw new DomainException(
                409,
                ProjectErrorCodes.ProjectNameAlreadyExists,
                "Project name already exists inside this workspace");
        }

        project.UpdateDetails(name, description, DateTimeOffset.UtcNow);
        await projectRepository.SaveChangesAsync(cancellationToken);

        return new UpdateProjectResult(ProjectResultMapper.ToResult(project));
    }
}
