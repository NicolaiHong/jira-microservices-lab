using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using ProjectService.Application;
using Xunit;

namespace ProjectService.Tests;

public sealed class ProjectApiPostgresIntegrationTests
{
    private const string InternalSecret = "project-api-test-secret";

    [PostgreSqlProjectFact]
    public async Task ProjectEndpointsPreservePatchSemanticsAndArchiveLifecycle()
    {
        await using var database = await ProjectPostgresIntegrationTests.ProjectDatabase.CreateAsync();
        var (workspaceId, ownerId) = await database.CreateWorkspaceWithOwnerAsync();
        var memberId = Guid.NewGuid();
        await database.AddMemberAsync(workspaceId, memberId, "MEMBER");
        await using var factory = new ProjectApiFactory(database.SchemaConnectionString);
        using var client = factory.CreateClient();

        var created = await SendJsonAsync(
            client,
            HttpMethod.Post,
            $"/internal/workspaces/{workspaceId}/projects",
            ownerId,
            new { name = "  Learning  ", key = " lrn ", description = "  Initial description  " });
        var createdBody = await ReadContractAsync(created, HttpStatusCode.Created, "projectResponse");
        var project = createdBody.RootElement.GetProperty("project");
        var projectId = project.GetProperty("id").GetGuid();
        Assert.Equal(workspaceId, project.GetProperty("workspaceId").GetGuid());
        Assert.Equal(ownerId, project.GetProperty("createdByUserId").GetGuid());
        Assert.Equal("Learning", project.GetProperty("name").GetString());
        Assert.Equal("LRN", project.GetProperty("key").GetString());

        var listed = await SendAsync(client, HttpMethod.Get, $"/internal/workspaces/{workspaceId}/projects", memberId);
        var listedBody = await ReadContractAsync(listed, HttpStatusCode.OK, "projectList");
        Assert.Equal(projectId, listedBody.RootElement.GetProperty("items")[0].GetProperty("id").GetGuid());
        var read = await SendAsync(client, HttpMethod.Get, $"/internal/projects/{projectId}", memberId);
        await ReadContractAsync(read, HttpStatusCode.OK, "project");

        var nameOnly = await SendJsonAsync(
            client,
            HttpMethod.Patch,
            $"/internal/projects/{projectId}",
            ownerId,
            new { name = "  Renamed  " });
        var nameOnlyBody = await ReadContractAsync(nameOnly, HttpStatusCode.OK, "projectResponse");
        Assert.Equal("Renamed", nameOnlyBody.RootElement.GetProperty("project").GetProperty("name").GetString());
        Assert.Equal("Initial description", nameOnlyBody.RootElement.GetProperty("project").GetProperty("description").GetString());

        var descriptionOnly = await SendJsonAsync(
            client,
            HttpMethod.Patch,
            $"/internal/projects/{projectId}",
            ownerId,
            new { description = "  Revised description  " });
        var descriptionOnlyBody = await ReadJsonAsync(descriptionOnly, HttpStatusCode.OK);
        Assert.Equal("Renamed", descriptionOnlyBody.RootElement.GetProperty("project").GetProperty("name").GetString());
        Assert.Equal("Revised description", descriptionOnlyBody.RootElement.GetProperty("project").GetProperty("description").GetString());

        var beforeNoOp = descriptionOnlyBody.RootElement.GetProperty("project").GetProperty("updatedAt").GetString();
        var noOp = await SendJsonAsync(
            client,
            HttpMethod.Patch,
            $"/internal/projects/{projectId}",
            ownerId,
            new { });
        var noOpBody = await ReadJsonAsync(noOp, HttpStatusCode.OK);
        Assert.Equal(beforeNoOp, noOpBody.RootElement.GetProperty("project").GetProperty("updatedAt").GetString());

        var clear = await SendJsonAsync(
            client,
            HttpMethod.Patch,
            $"/internal/projects/{projectId}",
            ownerId,
            new { description = (string?)null });
        var clearBody = await ReadContractAsync(clear, HttpStatusCode.OK, "projectResponse");
        Assert.Equal(JsonValueKind.Null, clearBody.RootElement.GetProperty("project").GetProperty("description").ValueKind);

        var whitespace = await SendJsonAsync(
            client,
            HttpMethod.Patch,
            $"/internal/projects/{projectId}",
            ownerId,
            new { description = "   ", key = "HACK", workspaceId = Guid.NewGuid() });
        var whitespaceBody = await ReadJsonAsync(whitespace, HttpStatusCode.OK);
        Assert.Equal(JsonValueKind.Null, whitespaceBody.RootElement.GetProperty("project").GetProperty("description").ValueKind);
        Assert.Equal("LRN", whitespaceBody.RootElement.GetProperty("project").GetProperty("key").GetString());
        Assert.Equal(workspaceId, whitespaceBody.RootElement.GetProperty("project").GetProperty("workspaceId").GetGuid());

        var archived = await SendAsync(client, HttpMethod.Delete, $"/internal/projects/{projectId}", ownerId);
        Assert.Equal(HttpStatusCode.NoContent, archived.StatusCode);
        var archivedAgain = await SendAsync(client, HttpMethod.Delete, $"/internal/projects/{projectId}", ownerId);
        Assert.Equal(HttpStatusCode.NoContent, archivedAgain.StatusCode);
        var readArchived = await SendAsync(client, HttpMethod.Get, $"/internal/projects/{projectId}", memberId);
        var readArchivedBody = await ReadContractAsync(readArchived, HttpStatusCode.OK, "project");
        Assert.Equal("ARCHIVED", readArchivedBody.RootElement.GetProperty("status").GetString());
        var updateArchived = await SendJsonAsync(
            client,
            HttpMethod.Patch,
            $"/internal/projects/{projectId}",
            ownerId,
            new { name = "Rejected" });
        await AssertErrorAsync(updateArchived, HttpStatusCode.Conflict, "PROJECT_ARCHIVED");
    }

    [PostgreSqlProjectFact]
    public async Task ProjectEndpointsForbidMembersAndObscureNonMembers()
    {
        await using var database = await ProjectPostgresIntegrationTests.ProjectDatabase.CreateAsync();
        var (workspaceId, ownerId) = await database.CreateWorkspaceWithOwnerAsync();
        var memberId = Guid.NewGuid();
        await database.AddMemberAsync(workspaceId, memberId, "MEMBER");
        await using var factory = new ProjectApiFactory(database.SchemaConnectionString);
        using var client = factory.CreateClient();

        var memberCreate = await SendJsonAsync(
            client,
            HttpMethod.Post,
            $"/internal/workspaces/{workspaceId}/projects",
            memberId,
            new { name = "Learning", key = "LRN" });
        var nonMemberCreate = await SendJsonAsync(
            client,
            HttpMethod.Post,
            $"/internal/workspaces/{workspaceId}/projects",
            Guid.NewGuid(),
            new { name = "Learning", key = "LRN" });

        await AssertErrorAsync(memberCreate, HttpStatusCode.Forbidden, "WORKSPACE_PERMISSION_DENIED");
        await AssertErrorAsync(nonMemberCreate, HttpStatusCode.NotFound, "WORKSPACE_NOT_FOUND");

        var created = await SendJsonAsync(
            client,
            HttpMethod.Post,
            $"/internal/workspaces/{workspaceId}/projects",
            ownerId,
            new { name = "Learning", key = "LRN" });
        var createdBody = await ReadJsonAsync(created, HttpStatusCode.Created);
        var projectId = createdBody.RootElement.GetProperty("project").GetProperty("id").GetGuid();
        var memberPatch = await SendJsonAsync(
            client,
            HttpMethod.Patch,
            $"/internal/projects/{projectId}",
            memberId,
            new { name = "Rejected" });
        var hiddenPatch = await SendJsonAsync(
            client,
            HttpMethod.Patch,
            $"/internal/projects/{projectId}",
            Guid.NewGuid(),
            new { name = "Hidden" });

        await AssertErrorAsync(memberPatch, HttpStatusCode.Forbidden, "WORKSPACE_PERMISSION_DENIED");
        await AssertErrorAsync(hiddenPatch, HttpStatusCode.NotFound, "PROJECT_NOT_FOUND");
    }

    [PostgreSqlProjectFact]
    public async Task AccessContextAllowsCurrentMembersIncludingArchivedProjectsAndHidesRemovedMembers()
    {
        await using var database = await ProjectPostgresIntegrationTests.ProjectDatabase.CreateAsync();
        var (workspaceId, ownerId) = await database.CreateWorkspaceWithOwnerAsync();
        var memberId = Guid.NewGuid();
        await database.AddMemberAsync(workspaceId, memberId, "MEMBER");
        var project = await database.CreateProjectAsync(workspaceId, ownerId);
        await using var factory = new ProjectApiFactory(database.SchemaConnectionString);
        using var client = factory.CreateClient();

        var activeAccess = await SendAsync(
            client,
            HttpMethod.Get,
            $"/internal/projects/{project.Id}/access-context",
            memberId);
        var activeAccessBody = await ReadContractAsync(activeAccess, HttpStatusCode.OK, "accessContext");
        Assert.Equal(project.Id, activeAccessBody.RootElement.GetProperty("projectId").GetGuid());
        Assert.Equal(workspaceId, activeAccessBody.RootElement.GetProperty("workspaceId").GetGuid());
        Assert.Equal("LRN", activeAccessBody.RootElement.GetProperty("projectKey").GetString());
        Assert.Equal("ACTIVE", activeAccessBody.RootElement.GetProperty("projectStatus").GetString());
        Assert.Equal("MEMBER", activeAccessBody.RootElement.GetProperty("membershipRole").GetString());

        var archive = await SendAsync(
            client,
            HttpMethod.Delete,
            $"/internal/projects/{project.Id}",
            ownerId);
        Assert.Equal(HttpStatusCode.NoContent, archive.StatusCode);

        var archivedAccess = await SendAsync(
            client,
            HttpMethod.Get,
            $"/internal/projects/{project.Id}/access-context",
            memberId);
        var archivedAccessBody = await ReadContractAsync(archivedAccess, HttpStatusCode.OK, "accessContext");
        Assert.Equal("ARCHIVED", archivedAccessBody.RootElement.GetProperty("projectStatus").GetString());

        var removal = await SendAsync(
            client,
            HttpMethod.Delete,
            $"/internal/workspaces/{workspaceId}/members/{memberId}",
            ownerId);
        Assert.Equal(HttpStatusCode.NoContent, removal.StatusCode);

        var removedAccess = await SendAsync(
            client,
            HttpMethod.Get,
            $"/internal/projects/{project.Id}/access-context",
            memberId);
        await AssertErrorAsync(removedAccess, HttpStatusCode.NotFound, "PROJECT_NOT_FOUND");
    }

    [PostgreSqlProjectFact]
    public async Task WorkspaceMemberBodiesAndRequestFailuresMatchContracts()
    {
        await using var database = await ProjectPostgresIntegrationTests.ProjectDatabase.CreateAsync();
        var ownerId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        await using var factory = new ProjectApiFactory(
            database.SchemaConnectionString,
            new FakeUserDirectory(new DirectoryUser(ownerId, "owner@example.test")));
        using var client = factory.CreateClient();

        var created = await SendJsonAsync(client, HttpMethod.Post, "/internal/workspaces", ownerId,
            new { name = "Contracts", slug = $"contracts-{Guid.NewGuid():N}" });
        var workspaceId = (await ReadContractAsync(created, HttpStatusCode.Created, "workspaceResponse"))
            .RootElement.GetProperty("workspace").GetProperty("id").GetGuid();
        await ReadContractAsync(
            await SendAsync(client, HttpMethod.Get, "/internal/workspaces", ownerId), HttpStatusCode.OK, "workspaceList");
        await ReadContractAsync(
            await SendJsonAsync(client, HttpMethod.Post, $"/internal/workspaces/{workspaceId}/members", ownerId,
                new { userId = memberId, role = "MEMBER" }),
            HttpStatusCode.Created, "memberResponse");
        await ReadContractAsync(
            await SendJsonAsync(client, HttpMethod.Patch, $"/internal/workspaces/{workspaceId}/members/{memberId}", ownerId,
                new { role = "ADMIN" }),
            HttpStatusCode.OK, "memberResponse");
        var members = await ReadContractAsync(
            await SendAsync(client, HttpMethod.Get, $"/internal/workspaces/{workspaceId}/members", ownerId),
            HttpStatusCode.OK, "memberList");
        Assert.Contains(members.RootElement.GetProperty("items").EnumerateArray(),
            item => item.GetProperty("email").ValueKind == JsonValueKind.Null);

        var withoutSecret = new HttpRequestMessage(HttpMethod.Get, "/internal/workspaces");
        withoutSecret.Headers.Add("x-authenticated-user-id", ownerId.ToString());
        await AssertErrorAsync(await client.SendAsync(withoutSecret), HttpStatusCode.Unauthorized, "INTERNAL_SERVICE_AUTH_REQUIRED");
        var withoutUser = new HttpRequestMessage(HttpMethod.Get, "/internal/workspaces");
        withoutUser.Headers.Add("x-internal-service-secret", InternalSecret);
        await AssertErrorAsync(await client.SendAsync(withoutUser), HttpStatusCode.Unauthorized, "AUTH_CONTEXT_REQUIRED");
        await AssertErrorAsync(
            await SendAsync(client, HttpMethod.Get, "/internal/projects/not-a-uuid/access-context", ownerId),
            HttpStatusCode.BadRequest, "VALIDATION_ERROR");
        var malformed = CreateRequest(HttpMethod.Post, "/internal/workspaces", ownerId);
        malformed.Content = new StringContent("{not json", System.Text.Encoding.UTF8, "application/json");
        await AssertErrorAsync(await client.SendAsync(malformed), HttpStatusCode.BadRequest, "VALIDATION_ERROR");
    }

    private static Task<HttpResponseMessage> SendJsonAsync(
        HttpClient client,
        HttpMethod method,
        string path,
        Guid userId,
        object body)
    {
        var request = CreateRequest(method, path, userId);
        request.Content = JsonContent.Create(body);
        return client.SendAsync(request);
    }

    private static Task<HttpResponseMessage> SendAsync(
        HttpClient client,
        HttpMethod method,
        string path,
        Guid userId) => client.SendAsync(CreateRequest(method, path, userId));

    private static HttpRequestMessage CreateRequest(HttpMethod method, string path, Guid userId)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Add("x-authenticated-user-id", userId.ToString());
        request.Headers.Add("x-internal-service-secret", InternalSecret);
        return request;
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response, HttpStatusCode expectedStatus)
    {
        Assert.Equal(expectedStatus, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    }

    private static async Task<JsonDocument> ReadContractAsync(
        HttpResponseMessage response,
        HttpStatusCode expectedStatus,
        string definition)
    {
        Assert.Equal(expectedStatus, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        ContractSchemas.AssertMatches($"http/project.schema.json#/$defs/{definition}", body);
        return JsonDocument.Parse(body);
    }

    private static async Task AssertErrorAsync(
        HttpResponseMessage response,
        HttpStatusCode expectedStatus,
        string expectedCode)
    {
        Assert.Equal(expectedStatus, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        ContractSchemas.AssertMatches("http/error.schema.json", body);
        Assert.Equal(expectedCode, JsonDocument.Parse(body).RootElement.GetProperty("code").GetString());
    }

    private sealed class ProjectApiFactory : WebApplicationFactory<Program>
    {
        private readonly string? previousDatabaseUrl;
        private readonly string? previousInternalSecret;
        private readonly IUserDirectory? userDirectory;

        public ProjectApiFactory(string databaseUrl, IUserDirectory? userDirectory = null)
        {
            this.userDirectory = userDirectory;
            previousDatabaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
            previousInternalSecret = Environment.GetEnvironmentVariable("INTERNAL_SERVICE_SECRET");
            Environment.SetEnvironmentVariable("DATABASE_URL", databaseUrl);
            Environment.SetEnvironmentVariable("INTERNAL_SERVICE_SECRET", InternalSecret);
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            if (userDirectory is not null)
            {
                builder.ConfigureTestServices(services => services.AddSingleton(userDirectory));
            }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                Environment.SetEnvironmentVariable("DATABASE_URL", previousDatabaseUrl);
                Environment.SetEnvironmentVariable("INTERNAL_SERVICE_SECRET", previousInternalSecret);
            }

            base.Dispose(disposing);
        }
    }
}
