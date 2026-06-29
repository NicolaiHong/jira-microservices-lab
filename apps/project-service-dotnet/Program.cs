using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProjectService.Api;
using ProjectService.Application;
using ProjectService.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
});

var databaseUrl = builder.Configuration["DATABASE_URL"];
if (string.IsNullOrWhiteSpace(databaseUrl))
{
    throw new InvalidOperationException("DATABASE_URL is required for Project Service.");
}

builder.Services.AddDbContext<ProjectDbContext>(options =>
    options.UseNpgsql(databaseUrl));
builder.Services.AddScoped<ProjectApplicationService>();

var port = Environment.GetEnvironmentVariable("PORT") ?? "8082";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

var app = builder.Build();

app.UseProjectApiExceptionHandling();

app.MapHealthEndpoints();
app.MapInternalProjectEndpoints();

app.Run();
