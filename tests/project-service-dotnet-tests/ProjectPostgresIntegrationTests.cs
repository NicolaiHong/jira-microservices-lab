using Microsoft.EntityFrameworkCore;
using Npgsql;
using ProjectService.Application.DTOs;
using ProjectService.Application.UseCases;
using ProjectService.Domain;
using ProjectService.Domain.Exceptions;
using ProjectService.Domain.Repositories;
using ProjectService.Infrastructure.Data;
using ProjectService.Infrastructure.Data.Repositories;
using Xunit;

namespace ProjectService.Tests;

public sealed class PostgreSqlProjectFactAttribute : FactAttribute
{
    public PostgreSqlProjectFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(
                Environment.GetEnvironmentVariable("PROJECT_SERVICE_TEST_DATABASE_URL")))
        {
            Skip = "Set PROJECT_SERVICE_TEST_DATABASE_URL to run PostgreSQL Project tests.";
        }
    }
}

public sealed class ProjectPostgresIntegrationTests
{
    [PostgreSqlProjectFact]
    public async Task NameMigrationStopsAndReportsExistingCaseInsensitiveCollisions()
    {
        await using var database = await ProjectDatabase.CreateAsync(
            "20260824140000_EnforceWorkspaceOwnerInvariant");
        var workspaceId = Guid.NewGuid();
        var ownerId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        await using var context = database.CreateContext();
        context.Workspaces.Add(new Workspace
        {
            Id = workspaceId,
            Name = "Collision workspace",
            Slug = $"collision-{workspaceId:N}",
            OwnerUserId = ownerId,
            CreatedAt = now,
            UpdatedAt = now
        });
        context.Projects.AddRange(
            new Project
            {
                Id = Guid.NewGuid(),
                WorkspaceId = workspaceId,
                Name = "Learning",
                Key = "LRN",
                Status = ProjectStatuses.Active,
                CreatedByUserId = ownerId,
                CreatedAt = now,
                UpdatedAt = now
            },
            new Project
            {
                Id = Guid.NewGuid(),
                WorkspaceId = workspaceId,
                Name = "learning",
                Key = "LRN2",
                Status = ProjectStatuses.Active,
                CreatedByUserId = ownerId,
                CreatedAt = now,
                UpdatedAt = now
            });
        await context.SaveChangesAsync();

        var exception = await Assert.ThrowsAsync<PostgresException>(
            () => context.Database.MigrateAsync());

        Assert.Contains(workspaceId.ToString(), exception.MessageText);
        Assert.Contains("learning", exception.MessageText, StringComparison.OrdinalIgnoreCase);
    }

    [PostgreSqlProjectFact]
    public async Task CaseInsensitiveProjectNameConflictMapsToTheStableError()
    {
        await using var database = await ProjectDatabase.CreateAsync();
        var (workspaceId, ownerId) = await database.CreateWorkspaceWithOwnerAsync();

        await CreateAsync(database, workspaceId, ownerId, "Learning", "LRN");
        var exception = await Assert.ThrowsAsync<DomainException>(() =>
            CreateAsync(database, workspaceId, ownerId, "learning", "LRN2"));

        Assert.Equal(409, exception.StatusCode);
        Assert.Equal(ProjectErrorCodes.ProjectNameAlreadyExists, exception.Code);
    }

    [PostgreSqlProjectFact]
    public async Task SameProjectNameIsAllowedInDifferentWorkspaces()
    {
        await using var database = await ProjectDatabase.CreateAsync();
        var first = await database.CreateWorkspaceWithOwnerAsync();
        var second = await database.CreateWorkspaceWithOwnerAsync();

        await CreateAsync(database, first.WorkspaceId, first.OwnerId, "Learning", "LRN");
        await CreateAsync(database, second.WorkspaceId, second.OwnerId, "learning", "LRN");

        Assert.Equal(1, await database.CountProjectsAsync(first.WorkspaceId));
        Assert.Equal(1, await database.CountProjectsAsync(second.WorkspaceId));
    }

    [PostgreSqlProjectFact]
    public async Task ConcurrentSameKeyCreatesReturnOneSuccessAndTheStableConflict()
    {
        await using var database = await ProjectDatabase.CreateAsync();
        var (workspaceId, ownerId) = await database.CreateWorkspaceWithOwnerAsync();
        var barrier = new AsyncBarrier(2);

        await using var firstContext = database.CreateContext();
        await using var secondContext = database.CreateContext();
        var outcomes = await Task.WhenAll(
            CaptureAsync(() => CreateAsync(
                new BarrierProjectRepository(
                    new EfProjectRepository(firstContext),
                    barrier,
                    SynchronizationPoint.Key),
                new EfWorkspaceMemberRepository(firstContext),
                workspaceId,
                ownerId,
                "Learning",
                "LRN")),
            CaptureAsync(() => CreateAsync(
                new BarrierProjectRepository(
                    new EfProjectRepository(secondContext),
                    barrier,
                    SynchronizationPoint.Key),
                new EfWorkspaceMemberRepository(secondContext),
                workspaceId,
                ownerId,
                "Research",
                "LRN")));

        AssertOneSucceededAndOneReturned(outcomes, ProjectErrorCodes.ProjectKeyAlreadyExists);
        Assert.Equal(1, await database.CountProjectsAsync(workspaceId));
    }

    [PostgreSqlProjectFact]
    public async Task ConcurrentCaseInsensitiveNameCreatesReturnOneSuccessAndTheStableConflict()
    {
        await using var database = await ProjectDatabase.CreateAsync();
        var (workspaceId, ownerId) = await database.CreateWorkspaceWithOwnerAsync();
        var barrier = new AsyncBarrier(2);

        await using var firstContext = database.CreateContext();
        await using var secondContext = database.CreateContext();
        var outcomes = await Task.WhenAll(
            CaptureAsync(() => CreateAsync(
                new BarrierProjectRepository(
                    new EfProjectRepository(firstContext),
                    barrier,
                    SynchronizationPoint.Name),
                new EfWorkspaceMemberRepository(firstContext),
                workspaceId,
                ownerId,
                "Learning",
                "LRN")),
            CaptureAsync(() => CreateAsync(
                new BarrierProjectRepository(
                    new EfProjectRepository(secondContext),
                    barrier,
                    SynchronizationPoint.Name),
                new EfWorkspaceMemberRepository(secondContext),
                workspaceId,
                ownerId,
                "learning",
                "LRN2")));

        AssertOneSucceededAndOneReturned(outcomes, ProjectErrorCodes.ProjectNameAlreadyExists);
        Assert.Equal(1, await database.CountProjectsAsync(workspaceId));
    }

    [PostgreSqlProjectFact]
    public async Task ArchiveWinningOverAStalePatchReturnsProjectArchivedAndPreservesArchivedState()
    {
        await using var database = await ProjectDatabase.CreateAsync();
        var (workspaceId, ownerId) = await database.CreateWorkspaceWithOwnerAsync();
        var project = await database.CreateProjectAsync(workspaceId, ownerId);
        var updateReady = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var archiveCommitted = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

        await using var updateContext = database.CreateContext();
        await using var archiveContext = database.CreateContext();
        var update = new UpdateProjectUseCase(
            new DelayedUpdateProjectRepository(
                new EfProjectRepository(updateContext),
                updateReady,
                archiveCommitted),
            new EfWorkspaceMemberRepository(updateContext));
        var archive = new ArchiveProjectUseCase(
            new ReleasingArchiveProjectRepository(
                new EfProjectRepository(archiveContext),
                archiveCommitted),
            new EfWorkspaceMemberRepository(archiveContext));

        var updateTask = CaptureAsync(() => update.ExecuteAsync(
            project.Id,
            new UpdateProjectCommand(true, "Updated", false, null),
            ownerId,
            CancellationToken.None));
        await updateReady.Task.WaitAsync(TimeSpan.FromSeconds(10));
        await archive.ExecuteAsync(project.Id, ownerId, CancellationToken.None);
        var updateOutcome = await updateTask;

        Assert.False(updateOutcome.Succeeded);
        Assert.Equal(ProjectErrorCodes.ProjectArchived, updateOutcome.DomainErrorCode);
        Assert.Equal(ProjectStatuses.Archived, (await database.ReadProjectAsync(project.Id)).Status);
    }

    [PostgreSqlProjectFact]
    public async Task ConcurrentActivePatchesRemainLastWriteWinsWithoutAConcurrencyError()
    {
        await using var database = await ProjectDatabase.CreateAsync();
        var (workspaceId, ownerId) = await database.CreateWorkspaceWithOwnerAsync();
        var project = await database.CreateProjectAsync(workspaceId, ownerId);
        var barrier = new AsyncBarrier(2);

        await using var firstContext = database.CreateContext();
        await using var secondContext = database.CreateContext();
        var outcomes = await Task.WhenAll(
            CaptureAsync(() => new UpdateProjectUseCase(
                new BarrierProjectRepository(
                    new EfProjectRepository(firstContext),
                    barrier,
                    SynchronizationPoint.Update),
                new EfWorkspaceMemberRepository(firstContext)).ExecuteAsync(
                    project.Id,
                    new UpdateProjectCommand(true, "First update", false, null),
                    ownerId,
                    CancellationToken.None)),
            CaptureAsync(() => new UpdateProjectUseCase(
                new BarrierProjectRepository(
                    new EfProjectRepository(secondContext),
                    barrier,
                    SynchronizationPoint.Update),
                new EfWorkspaceMemberRepository(secondContext)).ExecuteAsync(
                    project.Id,
                    new UpdateProjectCommand(true, "Second update", false, null),
                    ownerId,
                    CancellationToken.None)));

        Assert.All(outcomes, outcome => Assert.True(outcome.Succeeded));
        var persisted = await database.ReadProjectAsync(project.Id);
        Assert.Contains(persisted.Name, new[] { "First update", "Second update" });
        Assert.Equal(ProjectStatuses.Active, persisted.Status);
    }

    private static async Task CreateAsync(
        ProjectDatabase database,
        Guid workspaceId,
        Guid ownerId,
        string name,
        string key)
    {
        await using var context = database.CreateContext();
        await CreateAsync(
            new EfProjectRepository(context),
            new EfWorkspaceMemberRepository(context),
            workspaceId,
            ownerId,
            name,
            key);
    }

    private static Task CreateAsync(
        IProjectRepository projects,
        IWorkspaceMemberRepository members,
        Guid workspaceId,
        Guid ownerId,
        string name,
        string key) =>
        new CreateProjectUseCase(projects, members).ExecuteAsync(
            workspaceId,
            new CreateProjectCommand(name, key, null),
            ownerId,
            CancellationToken.None);

    private static async Task<MutationOutcome> CaptureAsync(Func<Task> mutation)
    {
        try
        {
            await mutation();
            return new MutationOutcome(true, null, null);
        }
        catch (DomainException exception)
        {
            return new MutationOutcome(false, exception.Code, null);
        }
        catch (Exception exception)
        {
            return new MutationOutcome(false, null, exception);
        }
    }

    private static void AssertOneSucceededAndOneReturned(
        IReadOnlyCollection<MutationOutcome> outcomes,
        string expectedCode)
    {
        Assert.All(outcomes, outcome => Assert.Null(outcome.UnexpectedException));
        Assert.Single(outcomes, outcome => outcome.Succeeded);
        Assert.Equal(expectedCode, Assert.Single(outcomes, outcome => !outcome.Succeeded).DomainErrorCode);
    }

    private sealed record MutationOutcome(
        bool Succeeded,
        string? DomainErrorCode,
        Exception? UnexpectedException);

    private enum SynchronizationPoint
    {
        Key,
        Name,
        Update
    }

    private sealed class AsyncBarrier(int participantCount)
    {
        private readonly TaskCompletionSource<bool> release = new(
            TaskCreationOptions.RunContinuationsAsynchronously);
        private int arrived;

        public Task SignalAndWaitAsync()
        {
            if (Interlocked.Increment(ref arrived) == participantCount)
            {
                release.TrySetResult(true);
            }

            return release.Task.WaitAsync(TimeSpan.FromSeconds(10));
        }
    }

    private sealed class BarrierProjectRepository(
        IProjectRepository inner,
        AsyncBarrier barrier,
        SynchronizationPoint point) : IProjectRepository
    {
        public Task<Project?> FindByIdAsync(Guid projectId, CancellationToken cancellationToken) =>
            inner.FindByIdAsync(projectId, cancellationToken);

        public Task<IReadOnlyList<Project>> ListByWorkspaceIdAsync(Guid workspaceId, CancellationToken cancellationToken) =>
            inner.ListByWorkspaceIdAsync(workspaceId, cancellationToken);

        public async Task<bool> AnyByKeyAsync(Guid workspaceId, string key, CancellationToken cancellationToken)
        {
            var result = await inner.AnyByKeyAsync(workspaceId, key, cancellationToken);
            if (point == SynchronizationPoint.Key)
            {
                await barrier.SignalAndWaitAsync();
            }
            return result;
        }

        public async Task<bool> AnyByNameAsync(Guid workspaceId, string name, CancellationToken cancellationToken)
        {
            var result = await inner.AnyByNameAsync(workspaceId, name, cancellationToken);
            if (point == SynchronizationPoint.Name)
            {
                await barrier.SignalAndWaitAsync();
            }
            return result;
        }

        public async Task<bool> UpdateActiveAsync(Guid projectId, string name, string? description, DateTimeOffset updatedAt, CancellationToken cancellationToken)
        {
            if (point == SynchronizationPoint.Update)
            {
                await barrier.SignalAndWaitAsync();
            }
            return await inner.UpdateActiveAsync(projectId, name, description, updatedAt, cancellationToken);
        }

        public Task<bool> ArchiveActiveAsync(Guid projectId, DateTimeOffset archivedAt, CancellationToken cancellationToken) =>
            inner.ArchiveActiveAsync(projectId, archivedAt, cancellationToken);

        public Task AddAsync(Project project, CancellationToken cancellationToken) =>
            inner.AddAsync(project, cancellationToken);

        public Task SaveChangesAsync(CancellationToken cancellationToken) =>
            inner.SaveChangesAsync(cancellationToken);
    }

    private sealed class DelayedUpdateProjectRepository(
        IProjectRepository inner,
        TaskCompletionSource<bool> updateReady,
        TaskCompletionSource<bool> archiveCommitted) : IProjectRepository
    {
        public Task<Project?> FindByIdAsync(Guid projectId, CancellationToken cancellationToken) => inner.FindByIdAsync(projectId, cancellationToken);
        public Task<IReadOnlyList<Project>> ListByWorkspaceIdAsync(Guid workspaceId, CancellationToken cancellationToken) => inner.ListByWorkspaceIdAsync(workspaceId, cancellationToken);
        public Task<bool> AnyByKeyAsync(Guid workspaceId, string key, CancellationToken cancellationToken) => inner.AnyByKeyAsync(workspaceId, key, cancellationToken);
        public Task<bool> AnyByNameAsync(Guid workspaceId, string name, CancellationToken cancellationToken) => inner.AnyByNameAsync(workspaceId, name, cancellationToken);
        public async Task<bool> UpdateActiveAsync(Guid projectId, string name, string? description, DateTimeOffset updatedAt, CancellationToken cancellationToken)
        {
            updateReady.TrySetResult(true);
            await archiveCommitted.Task.WaitAsync(TimeSpan.FromSeconds(10), cancellationToken);
            return await inner.UpdateActiveAsync(projectId, name, description, updatedAt, cancellationToken);
        }
        public Task<bool> ArchiveActiveAsync(Guid projectId, DateTimeOffset archivedAt, CancellationToken cancellationToken) => inner.ArchiveActiveAsync(projectId, archivedAt, cancellationToken);
        public Task AddAsync(Project project, CancellationToken cancellationToken) => inner.AddAsync(project, cancellationToken);
        public Task SaveChangesAsync(CancellationToken cancellationToken) => inner.SaveChangesAsync(cancellationToken);
    }

    private sealed class ReleasingArchiveProjectRepository(
        IProjectRepository inner,
        TaskCompletionSource<bool> archiveCommitted) : IProjectRepository
    {
        public Task<Project?> FindByIdAsync(Guid projectId, CancellationToken cancellationToken) => inner.FindByIdAsync(projectId, cancellationToken);
        public Task<IReadOnlyList<Project>> ListByWorkspaceIdAsync(Guid workspaceId, CancellationToken cancellationToken) => inner.ListByWorkspaceIdAsync(workspaceId, cancellationToken);
        public Task<bool> AnyByKeyAsync(Guid workspaceId, string key, CancellationToken cancellationToken) => inner.AnyByKeyAsync(workspaceId, key, cancellationToken);
        public Task<bool> AnyByNameAsync(Guid workspaceId, string name, CancellationToken cancellationToken) => inner.AnyByNameAsync(workspaceId, name, cancellationToken);
        public Task<bool> UpdateActiveAsync(Guid projectId, string name, string? description, DateTimeOffset updatedAt, CancellationToken cancellationToken) => inner.UpdateActiveAsync(projectId, name, description, updatedAt, cancellationToken);
        public async Task<bool> ArchiveActiveAsync(Guid projectId, DateTimeOffset archivedAt, CancellationToken cancellationToken)
        {
            try
            {
                return await inner.ArchiveActiveAsync(projectId, archivedAt, cancellationToken);
            }
            finally
            {
                archiveCommitted.TrySetResult(true);
            }
        }
        public Task AddAsync(Project project, CancellationToken cancellationToken) => inner.AddAsync(project, cancellationToken);
        public Task SaveChangesAsync(CancellationToken cancellationToken) => inner.SaveChangesAsync(cancellationToken);
    }

    internal sealed class ProjectDatabase(
        string connectionString,
        string schema,
        DbContextOptions<ProjectDbContext> options) : IAsyncDisposable
    {
        public static Task<ProjectDatabase> CreateAsync() => CreateAsync(null);

        public static async Task<ProjectDatabase> CreateAsync(string? targetMigration)
        {
            var connectionString = Environment.GetEnvironmentVariable("PROJECT_SERVICE_TEST_DATABASE_URL")
                ?? throw new InvalidOperationException("PROJECT_SERVICE_TEST_DATABASE_URL is required.");
            var schema = $"project_test_{Guid.NewGuid():N}";
            await using (var connection = new NpgsqlConnection(connectionString))
            {
                await connection.OpenAsync();
                await using var command = new NpgsqlCommand($"CREATE SCHEMA \"{schema}\";", connection);
                await command.ExecuteNonQueryAsync();
            }

            var schemaConnection = new NpgsqlConnectionStringBuilder(connectionString)
            {
                SearchPath = schema
            }.ConnectionString;
            var options = new DbContextOptionsBuilder<ProjectDbContext>()
                .UseNpgsql(schemaConnection)
                .Options;
            var database = new ProjectDatabase(connectionString, schema, options);
            await using var context = database.CreateContext();
            if (targetMigration is null)
            {
                await context.Database.MigrateAsync();
            }
            else
            {
                await context.Database.MigrateAsync(targetMigration);
            }
            return database;
        }

        public ProjectDbContext CreateContext() => new(options);

        public string SchemaConnectionString => new NpgsqlConnectionStringBuilder(connectionString)
        {
            SearchPath = schema
        }.ConnectionString;

        public async Task<(Guid WorkspaceId, Guid OwnerId)> CreateWorkspaceWithOwnerAsync()
        {
            var now = DateTimeOffset.UtcNow;
            var workspaceId = Guid.NewGuid();
            var ownerId = Guid.NewGuid();
            await using var context = CreateContext();
            context.Workspaces.Add(new Workspace
            {
                Id = workspaceId,
                Name = "Project tests",
                Slug = $"project-tests-{workspaceId:N}",
                OwnerUserId = ownerId,
                CreatedAt = now,
                UpdatedAt = now
            });
            context.WorkspaceMembers.Add(new WorkspaceMember
            {
                Id = Guid.NewGuid(),
                WorkspaceId = workspaceId,
                UserId = ownerId,
                Role = WorkspaceRoles.Owner,
                JoinedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            });
            await context.SaveChangesAsync();
            return (workspaceId, ownerId);
        }

        public async Task<Project> CreateProjectAsync(Guid workspaceId, Guid ownerId)
        {
            var now = DateTimeOffset.UtcNow;
            var project = new Project
            {
                Id = Guid.NewGuid(),
                WorkspaceId = workspaceId,
                Name = "Learning",
                Key = "LRN",
                Description = "Initial description",
                Status = ProjectStatuses.Active,
                CreatedByUserId = ownerId,
                CreatedAt = now,
                UpdatedAt = now
            };
            await using var context = CreateContext();
            context.Projects.Add(project);
            await context.SaveChangesAsync();
            return project;
        }

        public async Task AddMemberAsync(
            Guid workspaceId,
            Guid userId,
            string role)
        {
            var now = DateTimeOffset.UtcNow;
            await using var context = CreateContext();
            context.WorkspaceMembers.Add(new WorkspaceMember
            {
                Id = Guid.NewGuid(),
                WorkspaceId = workspaceId,
                UserId = userId,
                Role = role,
                JoinedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            });
            await context.SaveChangesAsync();
        }

        public async Task<int> CountProjectsAsync(Guid workspaceId)
        {
            await using var context = CreateContext();
            return await context.Projects.CountAsync(project => project.WorkspaceId == workspaceId);
        }

        public async Task<Project> ReadProjectAsync(Guid projectId)
        {
            await using var context = CreateContext();
            return await context.Projects.SingleAsync(project => project.Id == projectId);
        }

        public async ValueTask DisposeAsync()
        {
            await using var connection = new NpgsqlConnection(connectionString);
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand($"DROP SCHEMA IF EXISTS \"{schema}\" CASCADE;", connection);
            await command.ExecuteNonQueryAsync();
        }
    }
}
