using AppDtos = ProjectService.Application.DTOs;
using System.Text.Json;
using ProjectService.Application;

namespace ProjectService.Api.Mappers;

public static class ProjectDtoMapper
{
    public static AppDtos.CreateWorkspaceCommand? ToCommand(
        CreateWorkspaceRequest? request) =>
        request is null
            ? null
            : new AppDtos.CreateWorkspaceCommand(
                request.Name,
                request.Slug);

    public static CreateWorkspaceResponse ToResponse(
        AppDtos.CreateWorkspaceResult result) =>
        new(
            new WorkspaceResponse(
                result.Workspace.Id,
                result.Workspace.Name,
                result.Workspace.Slug,
                result.Workspace.OwnerUserId,
                result.Workspace.CreatedAt));

    public static ListUserWorkspacesResponse ToResponse(
        AppDtos.ListUserWorkspacesResult result) =>
        new(
            result.Items
                .Select(workspace => new UserWorkspaceResponse(
                    workspace.Id,
                    workspace.Name,
                    workspace.Slug,
                    workspace.Role,
                    workspace.CreatedAt))
                .ToList());

    public static AppDtos.CreateProjectCommand? ToCommand(
        CreateProjectRequest? request) =>
        request is null
            ? null
            : new AppDtos.CreateProjectCommand(
                request.Name,
                request.Key,
                request.Description);

    public static CreateProjectResponse ToResponse(
        AppDtos.CreateProjectResult result) =>
        new(ToResponse(result.Project));

    public static ListProjectsResponse ToResponse(
        AppDtos.ListProjectsResult result) =>
        new(result.Items.Select(ToResponse).ToList());

    public static UpdateProjectResponse ToResponse(
        AppDtos.UpdateProjectResult result) =>
        new(ToResponse(result.Project));

    public static ProjectResponse ToResponse(AppDtos.ProjectResult result) =>
        new(
            result.Id,
            result.WorkspaceId,
            result.Name,
            result.Key,
            result.Description,
            result.Status,
            result.CreatedByUserId,
            result.CreatedAt,
            result.UpdatedAt);

    public static AppDtos.UpdateProjectCommand? ToCommand(
        UpdateProjectRequest? request) =>
        request is null
            ? null
            : new AppDtos.UpdateProjectCommand(
                IsSpecified(request.Name),
                ToNullableString(request.Name, "name"),
                IsSpecified(request.Description),
                ToNullableString(request.Description, "description"));

    private static bool IsSpecified(JsonElement value) =>
        value.ValueKind != JsonValueKind.Undefined;

    private static string? ToNullableString(JsonElement value, string field) =>
        value.ValueKind switch
        {
            JsonValueKind.Undefined or JsonValueKind.Null => null,
            JsonValueKind.String => value.GetString(),
            _ => throw RequestValidation.ValidationError(
                field,
                $"{field} must be a string or null")
        };

    public static ProjectAccessContextResponse ToResponse(
        AppDtos.ProjectAccessContextResult result) =>
        new(
            result.ProjectId,
            result.WorkspaceId,
            result.ProjectKey,
            result.ProjectStatus,
            result.MembershipRole);

    public static AppDtos.AddWorkspaceMemberCommand? ToCommand(
        AddWorkspaceMemberRequest? request) =>
        request is null
            ? null
            : new AppDtos.AddWorkspaceMemberCommand(request.UserId, request.Role);

    public static AppDtos.ChangeWorkspaceMemberRoleCommand? ToCommand(
        ChangeWorkspaceMemberRoleRequest? request) =>
        request is null
            ? null
            : new AppDtos.ChangeWorkspaceMemberRoleCommand(request.Role);

    public static AddWorkspaceMemberResponse ToResponse(
        AppDtos.AddWorkspaceMemberResult result) =>
        new(ToResponse(result.Member));

    public static ChangeWorkspaceMemberRoleResponse ToResponse(
        AppDtos.ChangeWorkspaceMemberRoleResult result) =>
        new(ToResponse(result.Member));

    private static WorkspaceMemberResponse ToResponse(
        AppDtos.WorkspaceMemberResult member) =>
        new(member.UserId, member.Role, member.JoinedAt, member.UpdatedAt);
}
