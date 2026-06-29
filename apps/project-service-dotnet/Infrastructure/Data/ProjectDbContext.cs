using Microsoft.EntityFrameworkCore;
using ProjectService.Domain;

namespace ProjectService.Infrastructure.Data;

public sealed class ProjectDbContext(DbContextOptions<ProjectDbContext> options)
    : DbContext(options)
{
    public DbSet<Workspace> Workspaces => Set<Workspace>();
    public DbSet<WorkspaceMember> WorkspaceMembers => Set<WorkspaceMember>();
    public DbSet<Project> Projects => Set<Project>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Workspace>(entity =>
        {
            entity.ToTable("workspaces");

            entity.HasKey(workspace => workspace.Id);
            entity.Property(workspace => workspace.Id).HasColumnName("id");
            entity.Property(workspace => workspace.Name)
                .HasColumnName("name")
                .HasMaxLength(120)
                .IsRequired();
            entity.Property(workspace => workspace.Slug)
                .HasColumnName("slug")
                .HasMaxLength(80)
                .IsRequired();
            entity.Property(workspace => workspace.OwnerUserId)
                .HasColumnName("owner_user_id")
                .IsRequired();
            entity.Property(workspace => workspace.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();
            entity.Property(workspace => workspace.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();

            entity.HasIndex(workspace => workspace.Slug)
                .IsUnique()
                .HasDatabaseName("ux_workspaces_slug");
        });

        modelBuilder.Entity<WorkspaceMember>(entity =>
        {
            entity.ToTable("workspace_members", table =>
            {
                table.HasCheckConstraint(
                    "ck_workspace_members_role",
                    "role IN ('OWNER', 'ADMIN', 'MEMBER')");
            });

            entity.HasKey(member => member.Id);
            entity.Property(member => member.Id).HasColumnName("id");
            entity.Property(member => member.WorkspaceId)
                .HasColumnName("workspace_id")
                .IsRequired();
            entity.Property(member => member.UserId)
                .HasColumnName("user_id")
                .IsRequired();
            entity.Property(member => member.Role)
                .HasColumnName("role")
                .HasMaxLength(30)
                .IsRequired();
            entity.Property(member => member.JoinedAt)
                .HasColumnName("joined_at")
                .IsRequired();
            entity.Property(member => member.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();
            entity.Property(member => member.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();

            entity.HasOne(member => member.Workspace)
                .WithMany(workspace => workspace.Members)
                .HasForeignKey(member => member.WorkspaceId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(member => member.WorkspaceId)
                .HasDatabaseName("ix_workspace_members_workspace_id");
            entity.HasIndex(member => member.UserId)
                .HasDatabaseName("ix_workspace_members_user_id");
            entity.HasIndex(member => new { member.WorkspaceId, member.Role })
                .HasDatabaseName("ix_workspace_members_workspace_id_role");
            entity.HasIndex(member => new { member.WorkspaceId, member.UserId })
                .IsUnique()
                .HasDatabaseName("ux_workspace_members_workspace_id_user_id");
        });

        modelBuilder.Entity<Project>(entity =>
        {
            entity.ToTable("projects");

            entity.HasKey(project => project.Id);
            entity.Property(project => project.Id).HasColumnName("id");
            entity.Property(project => project.WorkspaceId)
                .HasColumnName("workspace_id")
                .IsRequired();
            entity.Property(project => project.Name)
                .HasColumnName("name")
                .HasMaxLength(120)
                .IsRequired();
            entity.Property(project => project.Key)
                .HasColumnName("key")
                .HasMaxLength(20)
                .IsRequired();
            entity.Property(project => project.Description)
                .HasColumnName("description");
            entity.Property(project => project.CreatedByUserId)
                .HasColumnName("created_by_user_id")
                .IsRequired();
            entity.Property(project => project.CreatedAt)
                .HasColumnName("created_at")
                .IsRequired();
            entity.Property(project => project.UpdatedAt)
                .HasColumnName("updated_at")
                .IsRequired();

            entity.HasOne(project => project.Workspace)
                .WithMany(workspace => workspace.Projects)
                .HasForeignKey(project => project.WorkspaceId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(project => project.WorkspaceId)
                .HasDatabaseName("ix_projects_workspace_id");
            entity.HasIndex(project => project.CreatedByUserId)
                .HasDatabaseName("ix_projects_created_by_user_id");
            entity.HasIndex(project => new { project.WorkspaceId, project.Key })
                .IsUnique()
                .HasDatabaseName("ux_projects_workspace_id_key");
            entity.HasIndex(project => new { project.WorkspaceId, project.Name })
                .IsUnique()
                .HasDatabaseName("ux_projects_workspace_id_name");
        });
    }
}
