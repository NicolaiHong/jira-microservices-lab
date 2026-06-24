using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
});

var port = Environment.GetEnvironmentVariable("PORT") ?? "8082";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

var app = builder.Build();

app.MapGet("/health", () =>
{
    var response = new HealthResponse(
        "ok",
        "project-service",
        "0.1.0",
        DateTimeOffset.UtcNow.ToString("O"),
        new Dictionary<string, string>
        {
            ["database"] = "not_checked",
            ["redis"] = "not_applicable",
            ["kafka"] = "not_checked"
        });

    return Results.Ok(response);
});

app.Run();

internal sealed record HealthResponse(
    string Status,
    string Service,
    string Version,
    string Timestamp,
    IReadOnlyDictionary<string, string> Dependencies);
