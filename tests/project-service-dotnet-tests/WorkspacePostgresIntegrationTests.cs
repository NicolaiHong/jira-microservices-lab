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

public sealed class PostgreSqlWorkspaceFactAttribute : FactAttribute
{
    public PostgreSqlWorkspaceFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(
                Environment.GetEnvironmentVariable("PROJECT_SERVICE_TEST_DATABASE_URL")))
        {
            Skip = "Set PROJECT_SERVICE_TEST_DATABASE_URL to run PostgreSQL Workspace concurrency tests.";
        }
    }
}

public sealed class WorkspacePostgresIntegrationTests
{
    [PostgreSqlWorkspaceFact]
    public async Task ConcurrentOwnerDemotionsLeaveOneOwnerAndReturnTheStableConflict()
    {
        await using var database = await WorkspaceDatabase.CreateAsync();
        var owners = await database.CreateOwnerPairAsync();
        var barrier = new AsyncBarrier(2);

        await using var firstContext = database.CreateContext();
        await using var secondContext = database.CreateContext();
        var firstRepository = new CoordinatedWorkspaceMemberRepository(
            new EfWorkspaceMemberRepository(firstContext),
            barrier,
            synchronizeOwnerCount: true);
        var secondRepository = new CoordinatedWorkspaceMemberRepository(
            new EfWorkspaceMemberRepository(secondContext),
            barrier,
            synchronizeOwnerCount: true);

        var outcomes = await Task.WhenAll(
            CaptureAsync(async () => await new ChangeWorkspaceMemberRoleUseCase(firstRepository)
                .ExecuteAsync(
                    owners.WorkspaceId,
                    owners.SecondOwnerId,
                    new ChangeWorkspaceMemberRoleCommand(WorkspaceRoles.Admin),
                    owners.FirstOwnerId,
                    CancellationToken.None)),
            CaptureAsync(async () => await new ChangeWorkspaceMemberRoleUseCase(secondRepository)
                .ExecuteAsync(
                    owners.WorkspaceId,
                    owners.FirstOwnerId,
                    new ChangeWorkspaceMemberRoleCommand(WorkspaceRoles.Admin),
                    owners.SecondOwnerId,
                    CancellationToken.None)));

        AssertOneMutationSucceededAndOneReturnedLastOwner(outcomes);
        Assert.Equal(1, await database.CountOwnersAsync(owners.WorkspaceId));
    }

    [PostgreSqlWorkspaceFact]
    public async Task ConcurrentOwnerRemovalsLeaveOneOwnerAndReturnTheStableConflict()
    {
        await using var database = await WorkspaceDatabase.CreateAsync();
        var owners = await database.CreateOwnerPairAsync();
        var barrier = new AsyncBarrier(2);

        await using var firstContext = database.CreateContext();
        await using var secondContext = database.CreateContext();
        var firstRepository = new CoordinatedWorkspaceMemberRepository(
            new EfWorkspaceMemberRepository(firstContext),
            barrier,
            synchronizeOwnerCount: true);
        var secondRepository = new CoordinatedWorkspaceMemberRepository(
            new EfWorkspaceMemberRepository(secondContext),
            barrier,
            synchronizeOwnerCount: true);

        var outcomes = await Task.WhenAll(
            CaptureAsync(async () => await new RemoveWorkspaceMemberUseCase(firstRepository)
                .ExecuteAsync(
                    owners.WorkspaceId,
                    owners.SecondOwnerId,
                    owners.FirstOwnerId,
                    CancellationToken.None)),
            CaptureAsync(async () => await new RemoveWorkspaceMemberUseCase(secondRepository)
                .ExecuteAsync(
                    owners.WorkspaceId,
                    owners.FirstOwnerId,
                    owners.SecondOwnerId,
                    CancellationToken.None)));

        AssertOneMutationSucceededAndOneReturnedLastOwner(outcomes);
        Assert.Equal(1, await database.CountOwnersAsync(owners.WorkspaceId));
    }

    [PostgreSqlWorkspaceFact]
    public async Task ConcurrentDuplicateMembershipAddsReturnTheStableConflict()
    {
        await using var database = await WorkspaceDatabase.CreateAsync();
        var (workspaceId, ownerId) = await database.CreateWorkspaceWithOwnerAsync();
        var targetUserId = Guid.NewGuid();
        var barrier = new AsyncBarrier(2);

        await using var firstContext = database.CreateContext();
        await using var secondContext = database.CreateContext();
        var firstRepository = new CoordinatedWorkspaceMemberRepository(
            new EfWorkspaceMemberRepository(firstContext),
            barrier,
            synchronizeMembershipUserId: targetUserId);
        var secondRepository = new CoordinatedWorkspaceMemberRepository(
            new EfWorkspaceMemberRepository(secondContext),
            barrier,
            synchronizeMembershipUserId: targetUserId);

        var outcomes = await Task.WhenAll(
            CaptureAsync(async () => await new AddWorkspaceMemberUseCase(firstRepository)
                .ExecuteAsync(
                    workspaceId,
                    new AddWorkspaceMemberCommand(targetUserId, WorkspaceRoles.Member),
                    ownerId,
                    CancellationToken.None)),
            CaptureAsync(async () => await new AddWorkspaceMemberUseCase(secondRepository)
                .ExecuteAsync(
                    workspaceId,
                    new AddWorkspaceMemberCommand(targetUserId, WorkspaceRoles.Member),
                    ownerId,
                    CancellationToken.None)));

        Assert.All(outcomes, outcome => Assert.Null(outcome.UnexpectedException));
        Assert.Single(outcomes, outcome => outcome.Succeeded);
        var rejected = Assert.Single(outcomes, outcome => !outcome.Succeeded);
        Assert.Equal(ProjectErrorCodes.WorkspaceMemberAlreadyExists, rejected.DomainErrorCode);
        Assert.Equal(1, await database.CountMembershipsAsync(workspaceId, targetUserId));
    }

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

    private static void AssertOneMutationSucceededAndOneReturnedLastOwner(
        IReadOnlyCollection<MutationOutcome> outcomes)
    {
        Assert.All(outcomes, outcome => Assert.Null(outcome.UnexpectedException));
        Assert.Single(outcomes, outcome => outcome.Succeeded);
        var rejected = Assert.Single(outcomes, outcome => !outcome.Succeeded);
        Assert.Equal(ProjectErrorCodes.LastWorkspaceOwner, rejected.DomainErrorCode);
    }

    private sealed record MutationOutcome(
        bool Succeeded,
        string? DomainErrorCode,
        Exception? UnexpectedException);

    private sealed class CoordinatedWorkspaceMemberRepository(
        IWorkspaceMemberRepository inner,
        AsyncBarrier barrier,
        bool synchronizeOwnerCount = false,
        Guid? synchronizeMembershipUserId = null)
        : IWorkspaceMemberRepository
    {
        public async Task<WorkspaceMember?> FindMembershipAsync(
            Guid workspaceId,
            Guid userId,
            CancellationToken cancellationToken)
        {
            var member = await inner.FindMembershipAsync(
                workspaceId,
                userId,
                cancellationToken);

            if (userId == synchronizeMembershipUserId)
            {
                await barrier.SignalAndWaitAsync();
            }

            return member;
        }

        public Task<IReadOnlyList<WorkspaceMember>> ListByUserIdAsync(
            Guid userId,
            CancellationToken cancellationToken) =>
            inner.ListByUserIdAsync(userId, cancellationToken);

        public async Task<int> CountOwnersAsync(
            Guid workspaceId,
            CancellationToken cancellationToken)
        {
            var count = await inner.CountOwnersAsync(workspaceId, cancellationToken);
            if (synchronizeOwnerCount)
            {
                await barrier.SignalAndWaitAsync();
            }

            return count;
        }

        public Task AddAsync(WorkspaceMember member, CancellationToken cancellationToken) =>
            inner.AddAsync(member, cancellationToken);

        public void Remove(WorkspaceMember member) => inner.Remove(member);

        public Task SaveChangesAsync(CancellationToken cancellationToken) =>
            inner.SaveChangesAsync(cancellationToken);
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

    private sealed class WorkspaceDatabase(
        string connectionString,
        string schema,
        DbContextOptions<ProjectDbContext> options)
        : IAsyncDisposable
    {
        public static async Task<WorkspaceDatabase> CreateAsync()
        {
            var baseConnectionString = Environment.GetEnvironmentVariable(
                "PROJECT_SERVICE_TEST_DATABASE_URL");
            if (string.IsNullOrWhiteSpace(baseConnectionString))
            {
                throw new InvalidOperationException(
                    "PROJECT_SERVICE_TEST_DATABASE_URL is required for PostgreSQL Workspace concurrency tests.");
            }

            var schema = $"workspace_test_{Guid.NewGuid():N}";
            await using (var connection = new NpgsqlConnection(baseConnectionString))
            {
                await connection.OpenAsync();
                await using var command = new NpgsqlCommand(
                    $"CREATE SCHEMA \"{schema}\";",
                    connection);
                await command.ExecuteNonQueryAsync();
            }

            var connectionStringBuilder = new NpgsqlConnectionStringBuilder(baseConnectionString)
            {
                SearchPath = schema
            };
            var options = new DbContextOptionsBuilder<ProjectDbContext>()
                .UseNpgsql(connectionStringBuilder.ConnectionString)
                .Options;
            var database = new WorkspaceDatabase(baseConnectionString, schema, options);

            await using var context = database.CreateContext();
            await context.Database.MigrateAsync();

            return database;
        }

        public ProjectDbContext CreateContext() => new(options);

        public async Task<(Guid WorkspaceId, Guid OwnerId)> CreateWorkspaceWithOwnerAsync()
        {
            var owners = await CreateOwnerPairAsync(includeSecondOwner: false);
            return (owners.WorkspaceId, owners.FirstOwnerId);
        }

        public Task<OwnerPair> CreateOwnerPairAsync() =>
            CreateOwnerPairAsync(includeSecondOwner: true);

        public async Task<int> CountOwnersAsync(Guid workspaceId)
        {
            await using var context = CreateContext();
            return await context.WorkspaceMembers.CountAsync(member =>
                member.WorkspaceId == workspaceId &&
                member.Role == WorkspaceRoles.Owner);
        }

        public async Task<int> CountMembershipsAsync(Guid workspaceId, Guid userId)
        {
            await using var context = CreateContext();
            return await context.WorkspaceMembers.CountAsync(member =>
                member.WorkspaceId == workspaceId && member.UserId == userId);
        }

        public async ValueTask DisposeAsync()
        {
            await using var connection = new NpgsqlConnection(connectionString);
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand(
                $"DROP SCHEMA IF EXISTS \"{schema}\" CASCADE;",
                connection);
            await command.ExecuteNonQueryAsync();
        }

        private async Task<OwnerPair> CreateOwnerPairAsync(bool includeSecondOwner)
        {
            var now = DateTimeOffset.UtcNow;
            var workspaceId = Guid.NewGuid();
            var firstOwnerId = Guid.NewGuid();
            var secondOwnerId = Guid.NewGuid();
            var workspace = new Workspace
            {
                Id = workspaceId,
                Name = "Concurrency workspace",
                Slug = $"concurrency-{workspaceId:N}",
                OwnerUserId = firstOwnerId,
                CreatedAt = now,
                UpdatedAt = now
            };
            var members = new List<WorkspaceMember>
            {
                CreateOwner(workspaceId, firstOwnerId, now)
            };
            if (includeSecondOwner)
            {
                members.Add(CreateOwner(workspaceId, secondOwnerId, now));
            }

            await using var context = CreateContext();
            context.Workspaces.Add(workspace);
            context.WorkspaceMembers.AddRange(members);
            await context.SaveChangesAsync();

            return new OwnerPair(workspaceId, firstOwnerId, secondOwnerId);
        }

        private static WorkspaceMember CreateOwner(
            Guid workspaceId,
            Guid userId,
            DateTimeOffset now) =>
            new()
            {
                Id = Guid.NewGuid(),
                WorkspaceId = workspaceId,
                UserId = userId,
                Role = WorkspaceRoles.Owner,
                JoinedAt = now,
                CreatedAt = now,
                UpdatedAt = now
            };
    }

    private sealed record OwnerPair(
        Guid WorkspaceId,
        Guid FirstOwnerId,
        Guid SecondOwnerId);
}
