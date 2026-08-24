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
        if (!command.HasName && !command.HasDescription)
        {
            return new UpdateProjectResult(ProjectResultMapper.ToResult(project));
        }

        var name = command.HasName
            ? RequestValidation.RequiredString(command.Name, "name", 120)
            : project.Name;
        var description = command.HasDescription
            ? RequestValidation.OptionalString(
                command.Description, "description", 2000)
            : project.Description;

        if (command.HasName &&
            !string.Equals(project.Name, name, StringComparison.OrdinalIgnoreCase) &&
            await projectRepository.AnyByNameAsync(
                project.WorkspaceId, name, cancellationToken))
        {
            throw new DomainException(
                409,
                ProjectErrorCodes.ProjectNameAlreadyExists,
                "Project name already exists inside this workspace");
        }

        var updatedAt = PostgresTimestamp.UtcNow();
        var updated = await projectRepository.UpdateActiveAsync(
            project.Id,
            name,
            description,
            updatedAt,
            cancellationToken);

        if (!updated)
        {
            throw new DomainException(
                409,
                ProjectErrorCodes.ProjectArchived,
                "Archived projects cannot be changed");
        }

        return new UpdateProjectResult(
            ProjectResultMapper.ToResult(project) with
            {
                Name = name,
                Description = description,
                UpdatedAt = updatedAt
            });
    }
}
