namespace ProjectService.Api;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/health", () =>
        {
            var response = new HealthResponse(
                "ok",
                "project-service",
                "0.3.0-week3-project-service",
                DateTimeOffset.UtcNow.ToString("O"),
                new Dictionary<string, string>
                {
                    ["database"] = "configured",
                    ["redis"] = "not_applicable",
                    ["kafka"] = "not_applicable"
                });

            return Results.Ok(response);
        });

        return app;
    }
}

internal sealed record HealthResponse(
    string Status,
    string Service,
    string Version,
    string Timestamp,
    IReadOnlyDictionary<string, string> Dependencies);
