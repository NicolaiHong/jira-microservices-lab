namespace ProjectService.Domain;

public sealed class WorkspaceMember
{
    public Guid Id { get; set; }
    public Guid WorkspaceId { get; set; }
    public Workspace Workspace { get; set; } = null!;
    public Guid UserId { get; set; }
    public string Role { get; set; } = WorkspaceRoles.Member;
    public DateTimeOffset JoinedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
