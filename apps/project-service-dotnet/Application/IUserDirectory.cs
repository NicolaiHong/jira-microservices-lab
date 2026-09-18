namespace ProjectService.Application;

public sealed record DirectoryUser(Guid Id, string Email);

// IAM owns account identity; Project resolves member emails through it (ADR 0003).
public interface IUserDirectory
{
    Task<IReadOnlyList<DirectoryUser>> LookupAsync(
        IReadOnlyCollection<Guid> ids,
        IReadOnlyCollection<string> emails,
        CancellationToken cancellationToken);
}
