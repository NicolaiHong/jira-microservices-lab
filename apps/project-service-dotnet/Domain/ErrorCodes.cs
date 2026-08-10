namespace ProjectService.Domain;

public static class ProjectErrorCodes
{
    public const string ValidationError = "VALIDATION_ERROR";
    public const string AuthContextRequired = "AUTH_CONTEXT_REQUIRED";
    public const string WorkspaceSlugAlreadyExists = "WORKSPACE_SLUG_ALREADY_EXISTS";
    public const string WorkspaceNotFound = "WORKSPACE_NOT_FOUND";
    public const string WorkspacePermissionDenied = "WORKSPACE_PERMISSION_DENIED";
    public const string ProjectKeyAlreadyExists = "PROJECT_KEY_ALREADY_EXISTS";
    public const string ProjectNameAlreadyExists = "PROJECT_NAME_ALREADY_EXISTS";
    public const string ProjectNotFound = "PROJECT_NOT_FOUND";
    public const string ProjectArchived = "PROJECT_ARCHIVED";
    public const string WorkspaceMemberAlreadyExists = "WORKSPACE_MEMBER_ALREADY_EXISTS";
    public const string WorkspaceMemberNotFound = "WORKSPACE_MEMBER_NOT_FOUND";
    public const string InvalidWorkspaceRole = "INVALID_WORKSPACE_ROLE";
    public const string LastWorkspaceOwner = "LAST_WORKSPACE_OWNER";
    public const string InternalError = "INTERNAL_ERROR";
}
