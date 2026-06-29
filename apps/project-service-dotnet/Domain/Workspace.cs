namespace ProjectService.Domain;

public sealed class Workspace
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public Guid OwnerUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<WorkspaceMember> Members { get; } = new List<WorkspaceMember>();
    public ICollection<Project> Projects { get; } = new List<Project>();
}
