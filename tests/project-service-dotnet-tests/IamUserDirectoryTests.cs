using System.Net;
using System.Text;
using ProjectService.Application;
using ProjectService.Domain;
using ProjectService.Domain.Exceptions;
using ProjectService.Infrastructure.Identity;
using Xunit;

namespace ProjectService.Tests;

public sealed class IamUserDirectoryTests
{
    [Fact]
    public async Task PostsIdsAndEmailsAndParsesMatches()
    {
        var userId = Guid.NewGuid();
        string? sentBody = null;
        var directory = Directory(async request =>
        {
            Assert.Equal("/internal/users/lookup", request.RequestUri!.AbsolutePath);
            sentBody = await request.Content!.ReadAsStringAsync();
            return Json(HttpStatusCode.OK, $$"""{"items":[{"id":"{{userId}}","email":"a@example.test"}]}""");
        });

        var users = await directory.LookupAsync([userId], ["a@example.test"], CancellationToken.None);

        Assert.Equal([new DirectoryUser(userId, "a@example.test")], users);
        Assert.Equal($$"""{"ids":["{{userId}}"],"emails":["a@example.test"]}""", sentBody);
    }

    [Fact]
    public async Task SplitsLargeLookupsIntoBoundedRequests()
    {
        var requests = 0;
        var directory = Directory(_ =>
        {
            requests++;
            return Task.FromResult(Json(HttpStatusCode.OK, """{"items":[]}"""));
        });

        await directory.LookupAsync(
            Enumerable.Range(0, 201).Select(_ => Guid.NewGuid()).ToList(),
            [],
            CancellationToken.None);

        Assert.Equal(3, requests);
    }

    [Theory]
    [InlineData("status")]
    [InlineData("malformed")]
    [InlineData("missing-email")]
    [InlineData("transport")]
    [InlineData("timeout")]
    public async Task EveryIamFailureMapsToServiceUnavailable(string failure)
    {
        var directory = Directory(_ => failure switch
        {
            "status" => Task.FromResult(Json(HttpStatusCode.InternalServerError, "{}")),
            "malformed" => Task.FromResult(Json(HttpStatusCode.OK, "not json")),
            "missing-email" => Task.FromResult(Json(HttpStatusCode.OK, $$"""{"items":[{"id":"{{Guid.NewGuid()}}"}]}""")),
            "transport" => throw new HttpRequestException("connection refused"),
            _ => throw new TaskCanceledException("timeout"),
        });

        var exception = await Assert.ThrowsAsync<DomainException>(() =>
            directory.LookupAsync([Guid.NewGuid()], [], CancellationToken.None));

        Assert.Equal((503, ProjectErrorCodes.IamServiceUnavailable), (exception.StatusCode, exception.Code));
    }

    private static IamUserDirectory Directory(Func<HttpRequestMessage, Task<HttpResponseMessage>> send) =>
        new(new HttpClient(new StubHandler(send)) { BaseAddress = new Uri("http://iam.test") });

    private static HttpResponseMessage Json(HttpStatusCode status, string body) =>
        new(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private sealed class StubHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> send)
        : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken) => send(request);
    }
}
