using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProjectService.Api;
using ProjectService.Application.UseCases;
using ProjectService.Domain.Repositories;
using ProjectService.Infrastructure.Data;
using ProjectService.Infrastructure.Data.Repositories;

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
builder.Services.AddScoped<IWorkspaceRepository, EfWorkspaceRepository>();
builder.Services.AddScoped<IWorkspaceMemberRepository, EfWorkspaceMemberRepository>();
builder.Services.AddScoped<IProjectRepository, EfProjectRepository>();
builder.Services.AddScoped<CreateWorkspaceUseCase>();
builder.Services.AddScoped<ListUserWorkspacesUseCase>();
builder.Services.AddScoped<CreateProjectUseCase>();

var port = Environment.GetEnvironmentVariable("PORT") ?? "8082";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

var app = builder.Build();

app.UseProjectApiExceptionHandling();

app.MapHealthEndpoints();
app.MapInternalProjectEndpoints();

app.Run();
