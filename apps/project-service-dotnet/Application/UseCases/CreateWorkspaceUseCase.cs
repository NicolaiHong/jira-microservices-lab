using ProjectService.Application.DTOs;
using ProjectService.Domain;
using ProjectService.Domain.Exceptions;
using ProjectService.Domain.Repositories;

namespace ProjectService.Application.UseCases;

public sealed class CreateWorkspaceUseCase(
    IWorkspaceRepository workspaceRepository,
    IWorkspaceMemberRepository workspaceMemberRepository)
{
    public async Task<CreateWorkspaceResult> ExecuteAsync(
        CreateWorkspaceCommand? command,
        Guid authenticatedUserId,
        CancellationToken cancellationToken)
    {
        if (command is null)
        {
            throw RequestValidation.ValidationError("body", "Request body is required");
        }

        var name = RequestValidation.RequiredString(command.Name, "name", 120);
        var slug = RequestValidation.NormalizeSlug(command.Slug);

        if (await workspaceRepository.AnyBySlugAsync(slug, cancellationToken))
        {
            throw WorkspaceSlugAlreadyExists();
        }

        var now = DateTimeOffset.UtcNow;
        var workspace = new Workspace
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = slug,
            OwnerUserId = authenticatedUserId,
            CreatedAt = now,
            UpdatedAt = now
        };
        var ownerMembership = new WorkspaceMember
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspace.Id,
            UserId = authenticatedUserId,
            Role = WorkspaceRoles.Owner,
            JoinedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };

        await workspaceRepository.AddAsync(workspace, cancellationToken);
        await workspaceMemberRepository.AddAsync(ownerMembership, cancellationToken);
        await workspaceRepository.SaveChangesAsync(cancellationToken);

        return new CreateWorkspaceResult(
            new WorkspaceResult(
                workspace.Id,
                workspace.Name,
                workspace.Slug,
                workspace.OwnerUserId,
                workspace.CreatedAt));
    }

    private static DomainException WorkspaceSlugAlreadyExists() =>
        new(
            409,
            ProjectErrorCodes.WorkspaceSlugAlreadyExists,
            "Workspace slug already exists");
}
