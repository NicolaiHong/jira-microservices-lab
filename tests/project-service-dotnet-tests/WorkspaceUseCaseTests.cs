using ProjectService.Application;
using ProjectService.Application.DTOs;
using ProjectService.Application.UseCases;
using ProjectService.Domain;
using ProjectService.Domain.Exceptions;
using ProjectService.Domain.Repositories;
using Xunit;

namespace ProjectService.Tests;

public sealed class WorkspaceUseCaseTests
{
    [Fact]
    public async Task AuthenticatedUserCreatesWorkspaceWithNormalizedSlugAndOwnerMembership()
    {
        var store = new WorkspaceStore();
        var useCase = CreateWorkspaceUseCase(store);
        var creatorId = Guid.NewGuid();

        var result = await useCase.ExecuteAsync(
            new CreateWorkspaceCommand("  Engineering  ", " Engineering_Team "),
            creatorId,
            CancellationToken.None);

        Assert.Equal("Engineering", result.Workspace.Name);
        Assert.Equal("engineering-team", result.Workspace.Slug);
        Assert.Equal(creatorId, result.Workspace.OwnerUserId);
        Assert.Contains(store.Members, member =>
            member.WorkspaceId == result.Workspace.Id &&
            member.UserId == creatorId &&
            member.Role == WorkspaceRoles.Owner);
    }

    [Fact]
    public async Task WorkspaceCreationRejectsMissingAndOverlongNames()
    {
        var missingName = await Assert.ThrowsAsync<DomainException>(() =>
            CreateWorkspaceUseCase(new WorkspaceStore()).ExecuteAsync(
                new CreateWorkspaceCommand(" ", "team"),
                Guid.NewGuid(),
                CancellationToken.None));

        var overlongName = await Assert.ThrowsAsync<DomainException>(() =>
            CreateWorkspaceUseCase(new WorkspaceStore()).ExecuteAsync(
                new CreateWorkspaceCommand(new string('a', 121), "team"),
                Guid.NewGuid(),
                CancellationToken.None));

        Assert.Equal(ProjectErrorCodes.ValidationError, missingName.Code);
        Assert.Equal(ProjectErrorCodes.ValidationError, overlongName.Code);
    }

    [Fact]
    public async Task WorkspaceCreationRejectsAnExistingNormalizedSlug()
    {
        var store = new WorkspaceStore();
        var useCase = CreateWorkspaceUseCase(store);

        await useCase.ExecuteAsync(
            new CreateWorkspaceCommand("First", "shared_team"),
            Guid.NewGuid(),
            CancellationToken.None);

        var exception = await Assert.ThrowsAsync<DomainException>(() =>
            useCase.ExecuteAsync(
                new CreateWorkspaceCommand("Second", "shared-team"),
                Guid.NewGuid(),
                CancellationToken.None));

        Assert.Equal(ProjectErrorCodes.WorkspaceSlugAlreadyExists, exception.Code);
    }

    [Fact]
    public async Task WorkspaceListingReturnsOnlyTheCallersMemberships()
    {
        var store = new WorkspaceStore();
        var callerId = Guid.NewGuid();
        var visible = AddWorkspace(store, "Visible", "visible");
        var privateWorkspace = AddWorkspace(store, "Private", "private");
        AddMember(store, visible.Id, callerId, WorkspaceRoles.Member);
        AddMember(store, privateWorkspace.Id, Guid.NewGuid(), WorkspaceRoles.Owner);

        var result = await new ListUserWorkspacesUseCase(
            new InMemoryWorkspaceMemberRepository(store),
            new InMemoryWorkspaceRepository(store)).ExecuteAsync(
                callerId,
                CancellationToken.None);

        var item = Assert.Single(result.Items);
        Assert.Equal(visible.Id, item.Id);
        Assert.Equal(WorkspaceRoles.Member, item.Role);
    }

    [Fact]
    public async Task MemberCannotManageWorkspaceMembers()
    {
        var store = new WorkspaceStore();
        var workspace = AddWorkspace(store, "Team", "team");
        var memberId = Guid.NewGuid();
        AddMember(store, workspace.Id, Guid.NewGuid(), WorkspaceRoles.Owner);
        AddMember(store, workspace.Id, memberId, WorkspaceRoles.Member);

        var exception = await Assert.ThrowsAsync<DomainException>(() =>
            new AddWorkspaceMemberUseCase(new InMemoryWorkspaceMemberRepository(store), FakeUserDirectory.Empty)
                .ExecuteAsync(
                    workspace.Id,
                    new AddWorkspaceMemberCommand(Guid.NewGuid(), WorkspaceRoles.Member),
                    memberId,
                    CancellationToken.None));

        Assert.Equal(403, exception.StatusCode);
        Assert.Equal(ProjectErrorCodes.WorkspacePermissionDenied, exception.Code);
    }

    [Fact]
    public async Task AdminCanManageNonOwnerMembers()
    {
        var store = new WorkspaceStore();
        var workspace = AddWorkspace(store, "Team", "team");
        var adminId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        AddMember(store, workspace.Id, Guid.NewGuid(), WorkspaceRoles.Owner);
        AddMember(store, workspace.Id, adminId, WorkspaceRoles.Admin);
        var repository = new InMemoryWorkspaceMemberRepository(store);

        var added = await new AddWorkspaceMemberUseCase(repository, FakeUserDirectory.Empty).ExecuteAsync(
            workspace.Id,
            new AddWorkspaceMemberCommand(targetId, WorkspaceRoles.Member),
            adminId,
            CancellationToken.None);
        var changed = await new ChangeWorkspaceMemberRoleUseCase(repository).ExecuteAsync(
            workspace.Id,
            targetId,
            new ChangeWorkspaceMemberRoleCommand(WorkspaceRoles.Admin),
            adminId,
            CancellationToken.None);
        await new RemoveWorkspaceMemberUseCase(repository).ExecuteAsync(
            workspace.Id,
            targetId,
            adminId,
            CancellationToken.None);

        Assert.Equal(WorkspaceRoles.Member, added.Member.Role);
        Assert.Equal(WorkspaceRoles.Admin, changed.Member.Role);
        Assert.DoesNotContain(store.Members, member => member.UserId == targetId);
    }

    [Fact]
    public async Task AdminCannotGrantModifyOrRemoveOwnerMemberships()
    {
        var store = new WorkspaceStore();
        var workspace = AddWorkspace(store, "Team", "team");
        var adminId = Guid.NewGuid();
        var ownerId = Guid.NewGuid();
        AddMember(store, workspace.Id, adminId, WorkspaceRoles.Admin);
        AddMember(store, workspace.Id, ownerId, WorkspaceRoles.Owner);
        var repository = new InMemoryWorkspaceMemberRepository(store);

        var grant = await Assert.ThrowsAsync<DomainException>(() =>
            new AddWorkspaceMemberUseCase(repository, FakeUserDirectory.Empty).ExecuteAsync(
                workspace.Id,
                new AddWorkspaceMemberCommand(Guid.NewGuid(), WorkspaceRoles.Owner),
                adminId,
                CancellationToken.None));
        var modify = await Assert.ThrowsAsync<DomainException>(() =>
            new ChangeWorkspaceMemberRoleUseCase(repository).ExecuteAsync(
                workspace.Id,
                ownerId,
                new ChangeWorkspaceMemberRoleCommand(WorkspaceRoles.Member),
                adminId,
                CancellationToken.None));
        var remove = await Assert.ThrowsAsync<DomainException>(() =>
            new RemoveWorkspaceMemberUseCase(repository).ExecuteAsync(
                workspace.Id,
                ownerId,
                adminId,
                CancellationToken.None));

        Assert.All(new[] { grant, modify, remove }, exception =>
        {
            Assert.Equal(403, exception.StatusCode);
            Assert.Equal(ProjectErrorCodes.WorkspacePermissionDenied, exception.Code);
        });
    }

    [Fact]
    public async Task OwnerCanManageOwnerAndNonOwnerRolesWithinTheSafeguards()
    {
        var store = new WorkspaceStore();
        var workspace = AddWorkspace(store, "Team", "team");
        var ownerId = Guid.NewGuid();
        var secondOwnerId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        AddMember(store, workspace.Id, ownerId, WorkspaceRoles.Owner);
        AddMember(store, workspace.Id, secondOwnerId, WorkspaceRoles.Owner);
        var repository = new InMemoryWorkspaceMemberRepository(store);

        var newOwner = await new AddWorkspaceMemberUseCase(repository, FakeUserDirectory.Empty).ExecuteAsync(
            workspace.Id,
            new AddWorkspaceMemberCommand(memberId, WorkspaceRoles.Owner),
            ownerId,
            CancellationToken.None);
        var changed = await new ChangeWorkspaceMemberRoleUseCase(repository).ExecuteAsync(
            workspace.Id,
            secondOwnerId,
            new ChangeWorkspaceMemberRoleCommand(WorkspaceRoles.Admin),
            ownerId,
            CancellationToken.None);
        await new RemoveWorkspaceMemberUseCase(repository).ExecuteAsync(
            workspace.Id,
            secondOwnerId,
            ownerId,
            CancellationToken.None);

        Assert.Equal(WorkspaceRoles.Owner, newOwner.Member.Role);
        Assert.Equal(WorkspaceRoles.Admin, changed.Member.Role);
        Assert.DoesNotContain(store.Members, member => member.UserId == secondOwnerId);
    }

    [Fact]
    public async Task MissingMemberReturnsNotFound()
    {
        var store = new WorkspaceStore();
        var workspace = AddWorkspace(store, "Team", "team");
        var ownerId = Guid.NewGuid();
        AddMember(store, workspace.Id, ownerId, WorkspaceRoles.Owner);

        var exception = await Assert.ThrowsAsync<DomainException>(() =>
            new ChangeWorkspaceMemberRoleUseCase(new InMemoryWorkspaceMemberRepository(store))
                .ExecuteAsync(
                    workspace.Id,
                    Guid.NewGuid(),
                    new ChangeWorkspaceMemberRoleCommand(WorkspaceRoles.Member),
                    ownerId,
                    CancellationToken.None));

        Assert.Equal(404, exception.StatusCode);
        Assert.Equal(ProjectErrorCodes.WorkspaceMemberNotFound, exception.Code);
    }

    [Fact]
    public async Task DuplicateMembershipReturnsTheStableConflict()
    {
        var store = new WorkspaceStore();
        var workspace = AddWorkspace(store, "Team", "team");
        var ownerId = Guid.NewGuid();
        var existingMemberId = Guid.NewGuid();
        AddMember(store, workspace.Id, ownerId, WorkspaceRoles.Owner);
        AddMember(store, workspace.Id, existingMemberId, WorkspaceRoles.Member);

        var exception = await Assert.ThrowsAsync<DomainException>(() =>
            new AddWorkspaceMemberUseCase(new InMemoryWorkspaceMemberRepository(store), FakeUserDirectory.Empty)
                .ExecuteAsync(
                    workspace.Id,
                    new AddWorkspaceMemberCommand(existingMemberId, WorkspaceRoles.Member),
                    ownerId,
                    CancellationToken.None));

        Assert.Equal(409, exception.StatusCode);
        Assert.Equal(ProjectErrorCodes.WorkspaceMemberAlreadyExists, exception.Code);
    }

    [Fact]
    public async Task NonMemberWorkspaceAccessReturnsNotFound()
    {
        var store = new WorkspaceStore();
        var workspace = AddWorkspace(store, "Team", "team");

        var exception = await Assert.ThrowsAsync<DomainException>(() =>
            new AddWorkspaceMemberUseCase(new InMemoryWorkspaceMemberRepository(store), FakeUserDirectory.Empty)
                .ExecuteAsync(
                    workspace.Id,
                    new AddWorkspaceMemberCommand(Guid.NewGuid(), WorkspaceRoles.Member),
                    Guid.NewGuid(),
                    CancellationToken.None));

        Assert.Equal(404, exception.StatusCode);
        Assert.Equal(ProjectErrorCodes.WorkspaceNotFound, exception.Code);
    }

    [Fact]
    public async Task LastOwnerCannotBeRemoved()
    {
        var store = new WorkspaceStore();
        var workspace = AddWorkspace(store, "Team", "team");
        var ownerId = Guid.NewGuid();
        AddMember(store, workspace.Id, ownerId, WorkspaceRoles.Owner);

        var exception = await Assert.ThrowsAsync<DomainException>(() =>
            new RemoveWorkspaceMemberUseCase(new InMemoryWorkspaceMemberRepository(store))
                .ExecuteAsync(workspace.Id, ownerId, ownerId, CancellationToken.None));

        Assert.Equal(ProjectErrorCodes.LastWorkspaceOwner, exception.Code);
    }

    [Fact]
    public async Task LastOwnerCannotBeDemoted()
    {
        var store = new WorkspaceStore();
        var workspace = AddWorkspace(store, "Team", "team");
        var ownerId = Guid.NewGuid();
        AddMember(store, workspace.Id, ownerId, WorkspaceRoles.Owner);

        var exception = await Assert.ThrowsAsync<DomainException>(() =>
            new ChangeWorkspaceMemberRoleUseCase(new InMemoryWorkspaceMemberRepository(store))
                .ExecuteAsync(
                    workspace.Id,
                    ownerId,
                    new ChangeWorkspaceMemberRoleCommand(WorkspaceRoles.Admin),
                    ownerId,
                    CancellationToken.None));

        Assert.Equal(ProjectErrorCodes.LastWorkspaceOwner, exception.Code);
    }

    [Fact]
    public async Task AnyMemberListsMembersWithDirectoryEmailsAndNonMembersGetNotFound()
    {
        var store = new WorkspaceStore();
        var workspace = AddWorkspace(store, "Team", "team");
        var ownerId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var orphanId = Guid.NewGuid();
        AddMember(store, workspace.Id, ownerId, WorkspaceRoles.Owner);
        AddMember(store, workspace.Id, memberId, WorkspaceRoles.Member);
        AddMember(store, workspace.Id, orphanId, WorkspaceRoles.Member);
        AddMember(store, Guid.NewGuid(), Guid.NewGuid(), WorkspaceRoles.Owner);
        var directory = new FakeUserDirectory(
            new DirectoryUser(ownerId, "owner@example.test"),
            new DirectoryUser(memberId, "member@example.test"));
        var useCase = new ListWorkspaceMembersUseCase(
            new InMemoryWorkspaceMemberRepository(store), directory);

        var result = await useCase.ExecuteAsync(workspace.Id, memberId, CancellationToken.None);
        var hidden = await Assert.ThrowsAsync<DomainException>(() =>
            useCase.ExecuteAsync(workspace.Id, Guid.NewGuid(), CancellationToken.None));

        Assert.Equal(
            [(ownerId, "owner@example.test"), (memberId, "member@example.test"), (orphanId, (string?)null)],
            result.Items.Select(item => (item.UserId, item.Email)).ToList());
        Assert.Equal(1, directory.Calls);
        Assert.Equal(ProjectErrorCodes.WorkspaceNotFound, hidden.Code);
    }

    [Fact]
    public async Task ManagerAddsMemberByNormalizedEmail()
    {
        var store = new WorkspaceStore();
        var workspace = AddWorkspace(store, "Team", "team");
        var ownerId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        AddMember(store, workspace.Id, ownerId, WorkspaceRoles.Owner);

        var added = await new AddWorkspaceMemberUseCase(
                new InMemoryWorkspaceMemberRepository(store),
                new FakeUserDirectory(new DirectoryUser(targetId, "target@example.test")))
            .ExecuteAsync(
                workspace.Id,
                new AddWorkspaceMemberCommand(null, WorkspaceRoles.Member, "  Target@Example.TEST "),
                ownerId,
                CancellationToken.None);

        Assert.Equal(targetId, added.Member.UserId);
        Assert.Contains(store.Members, member => member.WorkspaceId == workspace.Id && member.UserId == targetId);
    }

    [Fact]
    public async Task EmailAdditionRejectsUnknownAmbiguousAndUnauthorizedRequestsWithoutProbing()
    {
        var store = new WorkspaceStore();
        var workspace = AddWorkspace(store, "Team", "team");
        var ownerId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        AddMember(store, workspace.Id, ownerId, WorkspaceRoles.Owner);
        AddMember(store, workspace.Id, adminId, WorkspaceRoles.Admin);
        AddMember(store, workspace.Id, memberId, WorkspaceRoles.Member);
        var directory = new FakeUserDirectory(new DirectoryUser(Guid.NewGuid(), "known@example.test"));
        var useCase = new AddWorkspaceMemberUseCase(new InMemoryWorkspaceMemberRepository(store), directory);
        Task<AddWorkspaceMemberResult> Add(Guid actorId, AddWorkspaceMemberCommand command) =>
            useCase.ExecuteAsync(workspace.Id, command, actorId, CancellationToken.None);

        var unknown = await Assert.ThrowsAsync<DomainException>(() =>
            Add(ownerId, new AddWorkspaceMemberCommand(null, WorkspaceRoles.Member, "nobody@example.test")));
        Assert.Equal(1, directory.Calls);
        var both = await Assert.ThrowsAsync<DomainException>(() =>
            Add(ownerId, new AddWorkspaceMemberCommand(Guid.NewGuid(), WorkspaceRoles.Member, "known@example.test")));
        var malformed = await Assert.ThrowsAsync<DomainException>(() =>
            Add(ownerId, new AddWorkspaceMemberCommand(null, WorkspaceRoles.Member, "not-an-email")));
        var memberActor = await Assert.ThrowsAsync<DomainException>(() =>
            Add(memberId, new AddWorkspaceMemberCommand(null, WorkspaceRoles.Member, "known@example.test")));
        var adminGrantingOwner = await Assert.ThrowsAsync<DomainException>(() =>
            Add(adminId, new AddWorkspaceMemberCommand(null, WorkspaceRoles.Owner, "known@example.test")));
        var nonMember = await Assert.ThrowsAsync<DomainException>(() =>
            Add(Guid.NewGuid(), new AddWorkspaceMemberCommand(null, WorkspaceRoles.Member, "known@example.test")));

        Assert.Equal((404, ProjectErrorCodes.UserNotFound), (unknown.StatusCode, unknown.Code));
        Assert.Equal(ProjectErrorCodes.ValidationError, both.Code);
        Assert.Equal(ProjectErrorCodes.ValidationError, malformed.Code);
        Assert.Equal(ProjectErrorCodes.WorkspacePermissionDenied, memberActor.Code);
        Assert.Equal(ProjectErrorCodes.WorkspacePermissionDenied, adminGrantingOwner.Code);
        Assert.Equal(ProjectErrorCodes.WorkspaceNotFound, nonMember.Code);
        Assert.Equal(1, directory.Calls);
        Assert.Equal(3, store.Members.Count);
    }

    private static CreateWorkspaceUseCase CreateWorkspaceUseCase(WorkspaceStore store) =>
        new(
            new InMemoryWorkspaceRepository(store),
            new InMemoryWorkspaceMemberRepository(store));

    private static Workspace AddWorkspace(
        WorkspaceStore store,
        string name,
        string slug)
    {
        var workspace = new Workspace
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = slug,
            OwnerUserId = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        store.Workspaces.Add(workspace);
        return workspace;
    }

    private static void AddMember(
        WorkspaceStore store,
        Guid workspaceId,
        Guid userId,
        string role)
    {
        var now = DateTimeOffset.UtcNow;
        store.Members.Add(new WorkspaceMember
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            UserId = userId,
            Role = role,
            JoinedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        });
    }

    private sealed class WorkspaceStore
    {
        public List<Workspace> Workspaces { get; } = [];
        public List<WorkspaceMember> Members { get; } = [];
    }

    private sealed class InMemoryWorkspaceRepository(WorkspaceStore store)
        : IWorkspaceRepository
    {
        public Task<bool> AnyBySlugAsync(string slug, CancellationToken cancellationToken) =>
            Task.FromResult(store.Workspaces.Any(workspace => workspace.Slug == slug));

        public Task<IReadOnlyList<Workspace>> ListByIdsAsync(
            IReadOnlyCollection<Guid> workspaceIds,
            CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<Workspace>>(
                store.Workspaces
                    .Where(workspace => workspaceIds.Contains(workspace.Id))
                    .ToList());

        public Task AddAsync(Workspace workspace, CancellationToken cancellationToken)
        {
            store.Workspaces.Add(workspace);
            return Task.CompletedTask;
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken) =>
            Task.CompletedTask;
    }

    private sealed class InMemoryWorkspaceMemberRepository(WorkspaceStore store)
        : IWorkspaceMemberRepository
    {
        public Task<WorkspaceMember?> FindMembershipAsync(
            Guid workspaceId,
            Guid userId,
            CancellationToken cancellationToken) =>
            Task.FromResult(store.Members.SingleOrDefault(member =>
                member.WorkspaceId == workspaceId && member.UserId == userId));

        public Task<IReadOnlyList<WorkspaceMember>> ListByWorkspaceIdAsync(
            Guid workspaceId,
            CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<WorkspaceMember>>(
                store.Members.Where(member => member.WorkspaceId == workspaceId).ToList());

        public Task<IReadOnlyList<WorkspaceMember>> ListByUserIdAsync(
            Guid userId,
            CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<WorkspaceMember>>(
                store.Members.Where(member => member.UserId == userId).ToList());

        public Task<int> CountOwnersAsync(
            Guid workspaceId,
            CancellationToken cancellationToken) =>
            Task.FromResult(store.Members.Count(member =>
                member.WorkspaceId == workspaceId &&
                member.Role == WorkspaceRoles.Owner));

        public Task AddAsync(WorkspaceMember member, CancellationToken cancellationToken)
        {
            store.Members.Add(member);
            return Task.CompletedTask;
        }

        public void Remove(WorkspaceMember member) => store.Members.Remove(member);

        public Task SaveChangesAsync(CancellationToken cancellationToken) =>
            Task.CompletedTask;
    }
}

internal sealed class FakeUserDirectory(params DirectoryUser[] users) : IUserDirectory
{
    public static FakeUserDirectory Empty => new();

    public int Calls { get; private set; }

    public Task<IReadOnlyList<DirectoryUser>> LookupAsync(
        IReadOnlyCollection<Guid> ids,
        IReadOnlyCollection<string> emails,
        CancellationToken cancellationToken)
    {
        Calls++;
        return Task.FromResult<IReadOnlyList<DirectoryUser>>(users
            .Where(user => ids.Contains(user.Id) || emails.Contains(user.Email))
            .ToList());
    }
}
