namespace ProjectService.Domain;

public sealed class Project
{
    public Guid Id { get; set; }
    public Guid WorkspaceId { get; set; }
    public Workspace Workspace { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string Key { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = ProjectStatuses.Active;
    public Guid CreatedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public bool IsArchived => Status == ProjectStatuses.Archived;

    public void UpdateDetails(
        string name,
        string? description,
        DateTimeOffset updatedAt)
    {
        if (IsArchived)
        {
            throw new Exceptions.DomainException(
                409,
                ProjectErrorCodes.ProjectArchived,
                "Archived projects cannot be changed");
        }

        Name = name;
        Description = description;
        UpdatedAt = updatedAt;
    }

    public void Archive(DateTimeOffset archivedAt)
    {
        if (IsArchived)
        {
            return;
        }

        Status = ProjectStatuses.Archived;
        UpdatedAt = archivedAt;
    }
}
