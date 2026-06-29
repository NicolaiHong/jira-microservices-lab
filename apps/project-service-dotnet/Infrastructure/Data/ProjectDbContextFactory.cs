using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ProjectService.Infrastructure.Data;

public sealed class ProjectDbContextFactory
    : IDesignTimeDbContextFactory<ProjectDbContext>
{
    public ProjectDbContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable("DATABASE_URL") ??
            "Host=localhost;Port=5432;Database=project_db;Username=postgres;Password=postgres";

        var optionsBuilder = new DbContextOptionsBuilder<ProjectDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new ProjectDbContext(optionsBuilder.Options);
    }
}
