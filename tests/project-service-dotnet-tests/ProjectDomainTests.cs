using ProjectService.Domain;
using ProjectService.Domain.Exceptions;
using Xunit;

namespace ProjectService.Tests;

public sealed class ProjectDomainTests
{
    [Fact]
    public void ArchivedProjectRejectsDetailsChanges()
    {
        var project = NewProject();
        project.Archive(DateTimeOffset.UtcNow);

        var exception = Assert.Throws<DomainException>(() =>
            project.UpdateDetails("Changed", null, DateTimeOffset.UtcNow));

        Assert.Equal(ProjectErrorCodes.ProjectArchived, exception.Code);
    }

    [Fact]
    public void ArchiveIsIdempotent()
    {
        var project = NewProject();
        var firstArchive = DateTimeOffset.UtcNow;
        project.Archive(firstArchive);
        project.Archive(firstArchive.AddMinutes(1));

        Assert.Equal(ProjectStatuses.Archived, project.Status);
        Assert.Equal(firstArchive, project.UpdatedAt);
    }

    [Theory]
    [InlineData(WorkspaceRoles.Owner, true)]
    [InlineData(WorkspaceRoles.Admin, true)]
    [InlineData(WorkspaceRoles.Member, false)]
    public void ProjectManagementFollowsWorkspaceRole(string role, bool expected)
    {
        Assert.Equal(expected, WorkspaceRoles.CanManageProjects(role));
    }

    private static Project NewProject() => new()
    {
        Id = Guid.NewGuid(),
        WorkspaceId = Guid.NewGuid(),
        Name = "Learning",
        Key = "LRN",
        Status = ProjectStatuses.Active,
        CreatedByUserId = Guid.NewGuid(),
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow
    };
}
