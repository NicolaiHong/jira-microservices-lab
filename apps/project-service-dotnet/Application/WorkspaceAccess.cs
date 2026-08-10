using ProjectService.Domain;
using ProjectService.Domain.Exceptions;
using ProjectService.Domain.Repositories;

namespace ProjectService.Application;

internal static class WorkspaceAccess
{
    public static async Task<WorkspaceMember> RequireMembershipAsync(
        IWorkspaceMemberRepository repository,
        Guid workspaceId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var membership = await repository.FindMembershipAsync(
            workspaceId,
            userId,
            cancellationToken);

        return membership ?? throw new DomainException(
            404,
            ProjectErrorCodes.WorkspaceNotFound,
            "Workspace was not found");
    }

    public static void RequireMemberManager(WorkspaceMember actor)
    {
        if (!WorkspaceRoles.CanManageMembers(actor.Role))
        {
            throw PermissionDenied("Workspace role is not allowed to manage members");
        }
    }

    public static void RequireProjectManager(WorkspaceMember actor)
    {
        if (!WorkspaceRoles.CanManageProjects(actor.Role))
        {
            throw PermissionDenied("Workspace role is not allowed to manage projects");
        }
    }

    public static void RequireOwnerForOwnerRole(
        WorkspaceMember actor,
        string currentOrRequestedRole)
    {
        if (currentOrRequestedRole == WorkspaceRoles.Owner &&
            actor.Role != WorkspaceRoles.Owner)
        {
            throw PermissionDenied("Only an owner can grant or change an owner membership");
        }
    }

    public static DomainException ProjectNotFound() =>
        new(404, ProjectErrorCodes.ProjectNotFound, "Project was not found");

    private static DomainException PermissionDenied(string message) =>
        new(403, ProjectErrorCodes.WorkspacePermissionDenied, message);
}
