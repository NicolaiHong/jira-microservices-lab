namespace ProjectService.Domain;

public static class WorkspaceRoles
{
    public const string Owner = "OWNER";
    public const string Admin = "ADMIN";
    public const string Member = "MEMBER";

    public static bool CanCreateProject(string role) =>
        role is Owner or Admin;
}
