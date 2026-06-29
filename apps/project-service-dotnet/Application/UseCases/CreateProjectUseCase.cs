using ProjectService.Application.DTOs;
using ProjectService.Domain;
using ProjectService.Domain.Exceptions;
using ProjectService.Domain.Repositories;

namespace ProjectService.Application.UseCases;

public sealed class CreateProjectUseCase(
    IProjectRepository projectRepository,
    IWorkspaceMemberRepository workspaceMemberRepository)
{
    public async Task<CreateProjectResult> ExecuteAsync(
        Guid workspaceId,
        CreateProjectCommand? command,
        Guid authenticatedUserId,
        CancellationToken cancellationToken)
    {
        if (command is null)
        {
            throw RequestValidation.ValidationError("body", "Request body is required");
        }

        var membership = await workspaceMemberRepository.FindMembershipAsync(
            workspaceId,
            authenticatedUserId,
            cancellationToken);

        if (membership is null)
        {
            throw new DomainException(
                404,
                ProjectErrorCodes.WorkspaceNotFound,
                "Workspace was not found");
        }

        if (!WorkspaceRoles.CanCreateProject(membership.Role))
        {
            throw new DomainException(
                403,
                ProjectErrorCodes.WorkspacePermissionDenied,
                "Workspace role is not allowed to create projects");
        }

        var name = RequestValidation.RequiredString(command.Name, "name", 120);
        var key = RequestValidation.NormalizeProjectKey(command.Key);
        var description = RequestValidation.OptionalString(
            command.Description,
            "description",
            2000);

        if (await projectRepository.AnyByKeyAsync(
                workspaceId,
                key,
                cancellationToken))
        {
            throw ProjectKeyAlreadyExists();
        }

        if (await projectRepository.AnyByNameAsync(
                workspaceId,
                name,
                cancellationToken))
        {
            throw ProjectNameAlreadyExists();
        }

        var now = DateTimeOffset.UtcNow;
        var project = new Project
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            Name = name,
            Key = key,
            Description = description,
            CreatedByUserId = authenticatedUserId,
            CreatedAt = now,
            UpdatedAt = now
        };

        await projectRepository.AddAsync(project, cancellationToken);
        await projectRepository.SaveChangesAsync(cancellationToken);

        return new CreateProjectResult(
            new ProjectResult(
                project.Id,
                project.WorkspaceId,
                project.Name,
                project.Key,
                project.Description,
                project.CreatedByUserId,
                project.CreatedAt));
    }

    private static DomainException ProjectKeyAlreadyExists() =>
        new(
            409,
            ProjectErrorCodes.ProjectKeyAlreadyExists,
            "Project key already exists inside this workspace");

    private static DomainException ProjectNameAlreadyExists() =>
        new(
            409,
            ProjectErrorCodes.ProjectNameAlreadyExists,
            "Project name already exists inside this workspace");
}
