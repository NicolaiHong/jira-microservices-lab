using ProjectService.Application.DTOs;
using ProjectService.Application.UseCases;
using ProjectService.Domain;
using ProjectService.Domain.Exceptions;
using ProjectService.Domain.Repositories;
using Xunit;

namespace ProjectService.Tests;

public sealed class ProjectUseCaseTests
{
    [Theory]
    [InlineData(WorkspaceRoles.Owner)]
    [InlineData(WorkspaceRoles.Admin)]
    public async Task OwnerAndAdminCanCreateNormalizedProjects(string role)
    {
        var store = NewStore(role);

        var result = await CreateUseCase(store).ExecuteAsync(
            store.WorkspaceId,
            new CreateProjectCommand("  Learning  ", " lrn ", "  Course materials  "),
            store.ActorId,
            CancellationToken.None);

        Assert.Equal(store.WorkspaceId, result.Project.WorkspaceId);
        Assert.Equal(store.ActorId, result.Project.CreatedByUserId);
        Assert.Equal("Learning", result.Project.Name);
        Assert.Equal("LRN", result.Project.Key);
        Assert.Equal("Course materials", result.Project.Description);
    }

    [Fact]
    public async Task CreateRejectsInvalidNameKeyAndDescription()
    {
        var store = NewStore();
        var useCase = CreateUseCase(store);

        var invalidName = await Assert.ThrowsAsync<DomainException>(() =>
            useCase.ExecuteAsync(
                store.WorkspaceId,
                new CreateProjectCommand(" ", "LRN", null),
                store.ActorId,
                CancellationToken.None));
        var invalidKey = await Assert.ThrowsAsync<DomainException>(() =>
            useCase.ExecuteAsync(
                store.WorkspaceId,
                new CreateProjectCommand("Learning", "A-1", null),
                store.ActorId,
                CancellationToken.None));
        var overlongName = await Assert.ThrowsAsync<DomainException>(() =>
            useCase.ExecuteAsync(
                store.WorkspaceId,
                new CreateProjectCommand(new string('a', 121), "LRN", null),
                store.ActorId,
                CancellationToken.None));
        var overlongKey = await Assert.ThrowsAsync<DomainException>(() =>
            useCase.ExecuteAsync(
                store.WorkspaceId,
                new CreateProjectCommand("Learning", new string('A', 21), null),
                store.ActorId,
                CancellationToken.None));
        var overlongDescription = await Assert.ThrowsAsync<DomainException>(() =>
            useCase.ExecuteAsync(
                store.WorkspaceId,
                new CreateProjectCommand("Learning", "LRN", new string('a', 2001)),
                store.ActorId,
                CancellationToken.None));

        Assert.All(
            new[] { invalidName, invalidKey, overlongName, overlongKey, overlongDescription },
            exception => Assert.Equal(ProjectErrorCodes.ValidationError, exception.Code));
    }

    [Fact]
    public async Task CreateObscuresNonMembersAndForbidsMembers()
    {
        var memberStore = NewStore(WorkspaceRoles.Member);
        var memberException = await Assert.ThrowsAsync<DomainException>(() =>
            CreateUseCase(memberStore).ExecuteAsync(
                memberStore.WorkspaceId,
                new CreateProjectCommand("Learning", "LRN", null),
                memberStore.ActorId,
                CancellationToken.None));

        var nonMemberStore = NewStore();
        var nonMemberException = await Assert.ThrowsAsync<DomainException>(() =>
            CreateUseCase(nonMemberStore).ExecuteAsync(
                nonMemberStore.WorkspaceId,
                new CreateProjectCommand("Learning", "LRN", null),
                Guid.NewGuid(),
                CancellationToken.None));

        Assert.Equal(403, memberException.StatusCode);
        Assert.Equal(ProjectErrorCodes.WorkspacePermissionDenied, memberException.Code);
        Assert.Equal(404, nonMemberException.StatusCode);
        Assert.Equal(ProjectErrorCodes.WorkspaceNotFound, nonMemberException.Code);
    }

    [Fact]
    public async Task MembersCanListAndReadArchivedProjectsWhileNonMembersCannotDiscoverThem()
    {
        var store = NewStore(WorkspaceRoles.Member);
        var project = AddProject(store, status: ProjectStatuses.Archived);
        var list = new ListProjectsUseCase(Repository(store), Members(store));
        var get = new GetProjectUseCase(Repository(store), Members(store));

        var listed = await list.ExecuteAsync(store.WorkspaceId, store.ActorId, CancellationToken.None);
        var read = await get.ExecuteAsync(project.Id, store.ActorId, CancellationToken.None);
        var hidden = await Assert.ThrowsAsync<DomainException>(() =>
            get.ExecuteAsync(project.Id, Guid.NewGuid(), CancellationToken.None));

        Assert.Equal(project.Id, Assert.Single(listed.Items).Id);
        Assert.Equal(ProjectStatuses.Archived, read.Status);
        Assert.Equal(404, hidden.StatusCode);
        Assert.Equal(ProjectErrorCodes.ProjectNotFound, hidden.Code);
    }

    [Fact]
    public async Task PatchIsPresenceAwareAndLeavesAnEmptyPatchUntouched()
    {
        var store = NewStore();
        var project = AddProject(store, name: "Original", description: "Original description");
        var useCase = UpdateUseCase(store);
        var initialUpdatedAt = project.UpdatedAt;

        var noOp = await useCase.ExecuteAsync(
            project.Id,
            Patch(),
            store.ActorId,
            CancellationToken.None);
        Assert.Equal(0, store.DetailMutations);
        var nameOnly = await useCase.ExecuteAsync(
            project.Id,
            Patch(name: "  Renamed  "),
            store.ActorId,
            CancellationToken.None);
        var descriptionOnly = await useCase.ExecuteAsync(
            project.Id,
            Patch(description: "  Revised description  "),
            store.ActorId,
            CancellationToken.None);
        var cleared = await useCase.ExecuteAsync(
            project.Id,
            PatchWithNullDescription(),
            store.ActorId,
            CancellationToken.None);
        var whitespace = await useCase.ExecuteAsync(
            project.Id,
            Patch(description: "   "),
            store.ActorId,
            CancellationToken.None);

        Assert.Equal(initialUpdatedAt, noOp.Project.UpdatedAt);
        Assert.Equal("Renamed", nameOnly.Project.Name);
        Assert.Equal("Original description", nameOnly.Project.Description);
        Assert.Equal("Renamed", descriptionOnly.Project.Name);
        Assert.Equal("Revised description", descriptionOnly.Project.Description);
        Assert.Null(cleared.Project.Description);
        Assert.Null(whitespace.Project.Description);
        Assert.Equal("LRN", project.Key);
        Assert.Equal(store.WorkspaceId, project.WorkspaceId);
    }

    [Fact]
    public async Task PatchRequiresProjectManagementAccessAndRejectsArchivedProjects()
    {
        var memberStore = NewStore(WorkspaceRoles.Member);
        var memberProject = AddProject(memberStore);
        var denied = await Assert.ThrowsAsync<DomainException>(() =>
            UpdateUseCase(memberStore).ExecuteAsync(
                memberProject.Id,
                Patch(name: "Changed"),
                memberStore.ActorId,
                CancellationToken.None));

        var nonMemberStore = NewStore();
        var nonMemberProject = AddProject(nonMemberStore);
        var hidden = await Assert.ThrowsAsync<DomainException>(() =>
            UpdateUseCase(nonMemberStore).ExecuteAsync(
                nonMemberProject.Id,
                Patch(name: "Changed"),
                Guid.NewGuid(),
                CancellationToken.None));

        var archivedStore = NewStore();
        var archivedProject = AddProject(archivedStore, status: ProjectStatuses.Archived);
        var archived = await Assert.ThrowsAsync<DomainException>(() =>
            UpdateUseCase(archivedStore).ExecuteAsync(
                archivedProject.Id,
                Patch(name: "Changed"),
                archivedStore.ActorId,
                CancellationToken.None));

        Assert.Equal(403, denied.StatusCode);
        Assert.Equal(404, hidden.StatusCode);
        Assert.Equal(ProjectErrorCodes.ProjectArchived, archived.Code);
    }

    [Theory]
    [InlineData(WorkspaceRoles.Owner)]
    [InlineData(WorkspaceRoles.Admin)]
    public async Task OwnerAndAdminCanArchiveAndArchiveIsIdempotent(string role)
    {
        var store = NewStore(role);
        var project = AddProject(store);
        var useCase = new ArchiveProjectUseCase(Repository(store), Members(store));

        await useCase.ExecuteAsync(project.Id, store.ActorId, CancellationToken.None);
        var archivedAt = project.UpdatedAt;
        await useCase.ExecuteAsync(project.Id, store.ActorId, CancellationToken.None);

        Assert.Equal(ProjectStatuses.Archived, project.Status);
        Assert.Equal(archivedAt, project.UpdatedAt);
    }

    [Fact]
    public async Task MembersCannotArchiveProjects()
    {
        var store = NewStore(WorkspaceRoles.Member);
        var project = AddProject(store);

        var exception = await Assert.ThrowsAsync<DomainException>(() =>
            new ArchiveProjectUseCase(Repository(store), Members(store)).ExecuteAsync(
                project.Id,
                store.ActorId,
                CancellationToken.None));

        Assert.Equal(403, exception.StatusCode);
        Assert.Equal(ProjectErrorCodes.WorkspacePermissionDenied, exception.Code);
    }

    private static UpdateProjectCommand Patch(string? name = null, string? description = null) =>
        new(name is not null, name, description is not null || name is null && description is null && false, description);

    private static UpdateProjectCommand PatchWithNullDescription() =>
        new(false, null, true, null);

    private static ProjectStore NewStore(string role = WorkspaceRoles.Owner)
    {
        var store = new ProjectStore();
        store.Members.Add(new WorkspaceMember
        {
            Id = Guid.NewGuid(),
            WorkspaceId = store.WorkspaceId,
            UserId = store.ActorId,
            Role = role,
            JoinedAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        return store;
    }

    private static Project AddProject(
        ProjectStore store,
        string name = "Learning",
        string? description = null,
        string status = ProjectStatuses.Active)
    {
        var now = DateTimeOffset.UtcNow;
        var project = new Project
        {
            Id = Guid.NewGuid(),
            WorkspaceId = store.WorkspaceId,
            Name = name,
            Key = "LRN",
            Description = description,
            Status = status,
            CreatedByUserId = store.ActorId,
            CreatedAt = now,
            UpdatedAt = now
        };
        store.Projects.Add(project);
        return project;
    }

    private static CreateProjectUseCase CreateUseCase(ProjectStore store) =>
        new(Repository(store), Members(store));

    private static UpdateProjectUseCase UpdateUseCase(ProjectStore store) =>
        new(Repository(store), Members(store));

    private static InMemoryProjectRepository Repository(ProjectStore store) => new(store);

    private static InMemoryMemberRepository Members(ProjectStore store) => new(store);

    private sealed class ProjectStore
    {
        public Guid WorkspaceId { get; } = Guid.NewGuid();
        public Guid ActorId { get; } = Guid.NewGuid();
        public List<Project> Projects { get; } = [];
        public List<WorkspaceMember> Members { get; } = [];
        public int DetailMutations { get; set; }
    }

    private sealed class InMemoryProjectRepository(ProjectStore store) : IProjectRepository
    {
        public Task<Project?> FindByIdAsync(Guid projectId, CancellationToken cancellationToken) =>
            Task.FromResult(store.Projects.SingleOrDefault(project => project.Id == projectId));

        public Task<IReadOnlyList<Project>> ListByWorkspaceIdAsync(Guid workspaceId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<Project>>(store.Projects
                .Where(project => project.WorkspaceId == workspaceId)
                .OrderBy(project => project.Name)
                .ToList());

        public Task<bool> AnyByKeyAsync(Guid workspaceId, string key, CancellationToken cancellationToken) =>
            Task.FromResult(store.Projects.Any(project =>
                project.WorkspaceId == workspaceId && project.Key == key));

        public Task<bool> AnyByNameAsync(Guid workspaceId, string name, CancellationToken cancellationToken) =>
            Task.FromResult(store.Projects.Any(project =>
                project.WorkspaceId == workspaceId &&
                string.Equals(project.Name, name, StringComparison.OrdinalIgnoreCase)));

        public Task<bool> UpdateActiveAsync(
            Guid projectId,
            string name,
            string? description,
            DateTimeOffset updatedAt,
            CancellationToken cancellationToken)
        {
            var project = store.Projects.SingleOrDefault(project =>
                project.Id == projectId && project.Status == ProjectStatuses.Active);
            if (project is null)
            {
                return Task.FromResult(false);
            }

            store.DetailMutations++;
            project.Name = name;
            project.Description = description;
            project.UpdatedAt = updatedAt;
            return Task.FromResult(true);
        }

        public Task<bool> ArchiveActiveAsync(
            Guid projectId,
            DateTimeOffset archivedAt,
            CancellationToken cancellationToken)
        {
            var project = store.Projects.SingleOrDefault(project =>
                project.Id == projectId && project.Status == ProjectStatuses.Active);
            if (project is null)
            {
                return Task.FromResult(false);
            }

            project.Status = ProjectStatuses.Archived;
            project.UpdatedAt = archivedAt;
            return Task.FromResult(true);
        }

        public Task AddAsync(Project project, CancellationToken cancellationToken)
        {
            store.Projects.Add(project);
            return Task.CompletedTask;
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }

    private sealed class InMemoryMemberRepository(ProjectStore store) : IWorkspaceMemberRepository
    {
        public Task<WorkspaceMember?> FindMembershipAsync(
            Guid workspaceId,
            Guid userId,
            CancellationToken cancellationToken) =>
            Task.FromResult(store.Members.SingleOrDefault(member =>
                member.WorkspaceId == workspaceId && member.UserId == userId));

        public Task<IReadOnlyList<WorkspaceMember>> ListByUserIdAsync(
            Guid userId,
            CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<WorkspaceMember>>([]);

        public Task<int> CountOwnersAsync(Guid workspaceId, CancellationToken cancellationToken) =>
            Task.FromResult(0);

        public Task AddAsync(WorkspaceMember member, CancellationToken cancellationToken) =>
            Task.CompletedTask;

        public void Remove(WorkspaceMember member)
        {
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
