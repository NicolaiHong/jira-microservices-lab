using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectService.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "status",
                table: "projects",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "ACTIVE");

            migrationBuilder.AddCheckConstraint(
                name: "ck_projects_status",
                table: "projects",
                sql: "status IN ('ACTIVE', 'ARCHIVED')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_projects_status",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "status",
                table: "projects");
        }
    }
}
