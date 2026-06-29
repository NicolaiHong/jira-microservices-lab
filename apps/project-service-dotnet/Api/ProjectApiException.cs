namespace ProjectService.Api;

public sealed class ProjectApiException : Exception
{
    public ProjectApiException(
        int statusCode,
        string code,
        string message,
        IReadOnlyDictionary<string, object?>? details = null)
        : base(message)
    {
        StatusCode = statusCode;
        Code = code;
        Details = details ?? new Dictionary<string, object?>();
    }

    public int StatusCode { get; }
    public string Code { get; }
    public IReadOnlyDictionary<string, object?> Details { get; }
}
