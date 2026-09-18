namespace ProjectService.Api;

public static class CorrelationId
{
    public const string HeaderName = "x-correlation-id";
    private const string ItemName = "ProjectService.CorrelationId";

    public static string GetOrCreate(HttpContext context)
    {
        if (context.Items.TryGetValue(ItemName, out var existing) &&
            existing is string correlationId)
        {
            return correlationId;
        }

        var requested = context.Request.Headers[HeaderName].FirstOrDefault();
        var value = string.IsNullOrWhiteSpace(requested)
            ? $"req_{Guid.NewGuid():N}"
            : requested.Trim();

        context.Items[ItemName] = value;
        context.Response.Headers[HeaderName] = value;
        return value;
    }
}

public sealed class CorrelationIdPropagationHandler(IHttpContextAccessor httpContextAccessor)
    : DelegatingHandler
{
    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        if (httpContextAccessor.HttpContext is { } context)
        {
            request.Headers.TryAddWithoutValidation(
                CorrelationId.HeaderName,
                CorrelationId.GetOrCreate(context));
        }

        return base.SendAsync(request, cancellationToken);
    }
}
