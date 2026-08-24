using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectService.Infrastructure.Data.Migrations;

[DbContext(typeof(ProjectDbContext))]
[Migration("20260824150000_EnforceCaseInsensitiveProjectNames")]
public partial class EnforceCaseInsensitiveProjectNames : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DO $$
            DECLARE
                collisions text;
            BEGIN
                SELECT string_agg(
                    format('(%s, %s)', workspace_id, normalized_name),
                    ', ')
                INTO collisions
                FROM (
                    SELECT workspace_id, lower(name) AS normalized_name
                    FROM projects
                    GROUP BY workspace_id, lower(name)
                    HAVING count(*) > 1
                ) AS duplicate_names;

                IF collisions IS NOT NULL THEN
                    RAISE EXCEPTION
                        'Cannot enforce case-insensitive Project names; collisions: %',
                        collisions;
                END IF;
            END;
            $$;

            DROP INDEX ux_projects_workspace_id_name;

            CREATE UNIQUE INDEX ux_projects_workspace_id_lower_name
            ON projects (workspace_id, lower(name));
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DROP INDEX ux_projects_workspace_id_lower_name;

            CREATE UNIQUE INDEX ux_projects_workspace_id_name
            ON projects (workspace_id, name);
            """);
    }
}
