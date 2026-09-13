using System.Net.Http.Json;
using System.Text.Json;
using ProjectService.Application;
using ProjectService.Domain;
using ProjectService.Domain.Exceptions;

namespace ProjectService.Infrastructure.Identity;

public sealed class IamUserDirectory(HttpClient httpClient) : IUserDirectory
{
    private const int MaxEntriesPerRequest = 100;

    public async Task<IReadOnlyList<DirectoryUser>> LookupAsync(
        IReadOnlyCollection<Guid> ids,
        IReadOnlyCollection<string> emails,
        CancellationToken cancellationToken)
    {
        var found = new List<DirectoryUser>();
        var idChunks = ids.Chunk(MaxEntriesPerRequest).ToList();
        var emailChunks = emails.Chunk(MaxEntriesPerRequest).ToList();
        for (var index = 0; index < Math.Max(idChunks.Count, emailChunks.Count); index++)
        {
            found.AddRange(await LookupChunkAsync(
                index < idChunks.Count ? idChunks[index] : [],
                index < emailChunks.Count ? emailChunks[index] : [],
                cancellationToken));
        }

        return found;
    }

    private async Task<IReadOnlyList<DirectoryUser>> LookupChunkAsync(
        Guid[] ids,
        string[] emails,
        CancellationToken cancellationToken)
    {
        try
        {
            using var response = await httpClient.PostAsJsonAsync(
                "/internal/users/lookup",
                new { ids, emails },
                cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                throw Unavailable();
            }

            var body = await response.Content.ReadFromJsonAsync<LookupResponse>(
                cancellationToken);
            return body?.Items is { } items && items.All(item => item.Email is not null)
                ? items
                : throw Unavailable();
        }
        catch (Exception exception) when (
            exception is HttpRequestException or TaskCanceledException or JsonException or NotSupportedException)
        {
            throw Unavailable();
        }
    }

    private static DomainException Unavailable() =>
        new(503, ProjectErrorCodes.IamServiceUnavailable, "Identity service is unavailable");

    private sealed record LookupResponse(IReadOnlyList<DirectoryUser>? Items);
}
