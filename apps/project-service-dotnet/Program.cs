using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProjectService.Api;
using ProjectService.Application;
using ProjectService.Application.UseCases;
using ProjectService.Domain.Repositories;
using ProjectService.Infrastructure.Data;
using ProjectService.Infrastructure.Data.Repositories;
using ProjectService.Infrastructure.Identity;

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

var internalServiceSecret = builder.Configuration["INTERNAL_SERVICE_SECRET"]
    ?? throw new InvalidOperationException("INTERNAL_SERVICE_SECRET is required.");

builder.Services.AddDbContext<ProjectDbContext>(options =>
    options.UseNpgsql(databaseUrl));
builder.Services.AddHttpContextAccessor();
builder.Services.AddTransient<CorrelationIdPropagationHandler>();
builder.Services.AddHttpClient<IUserDirectory, IamUserDirectory>(client =>
    {
        client.BaseAddress = new Uri(builder.Configuration["IAM_SERVICE_URL"] ?? "http://localhost:8081");
        client.Timeout = TimeSpan.FromMilliseconds(
            int.TryParse(builder.Configuration["HTTP_CLIENT_TIMEOUT_MS"], out var timeoutMs) ? timeoutMs : 3000);
        client.DefaultRequestHeaders.Add("x-internal-service-secret", internalServiceSecret);
    })
    .AddHttpMessageHandler<CorrelationIdPropagationHandler>();
builder.Services.AddScoped<IWorkspaceRepository, EfWorkspaceRepository>();
builder.Services.AddScoped<IWorkspaceMemberRepository, EfWorkspaceMemberRepository>();
builder.Services.AddScoped<IProjectRepository, EfProjectRepository>();
builder.Services.AddScoped<CreateWorkspaceUseCase>();
builder.Services.AddScoped<ListUserWorkspacesUseCase>();
builder.Services.AddScoped<CreateProjectUseCase>();
builder.Services.AddScoped<AddWorkspaceMemberUseCase>();
builder.Services.AddScoped<ListWorkspaceMembersUseCase>();
builder.Services.AddScoped<ChangeWorkspaceMemberRoleUseCase>();
builder.Services.AddScoped<RemoveWorkspaceMemberUseCase>();
builder.Services.AddScoped<ListProjectsUseCase>();
builder.Services.AddScoped<GetProjectUseCase>();
builder.Services.AddScoped<UpdateProjectUseCase>();
builder.Services.AddScoped<ArchiveProjectUseCase>();
builder.Services.AddScoped<GetProjectAccessContextUseCase>();

var port = Environment.GetEnvironmentVariable("PORT") ?? "8082";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ProjectDbContext>();
    await dbContext.Database.MigrateAsync();
}

app.UseProjectRequestLogging();
app.UseProjectApiExceptionHandling();
app.UseInternalServiceAuthentication(internalServiceSecret);

app.MapHealthEndpoints();
app.MapInternalProjectEndpoints();

app.Run();

public partial class Program;
