using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectService.Infrastructure.Data.Migrations;

[DbContext(typeof(ProjectDbContext))]
[Migration("20260824140000_EnforceWorkspaceOwnerInvariant")]
public partial class EnforceWorkspaceOwnerInvariant : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            CREATE OR REPLACE FUNCTION ensure_workspace_has_owner()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            BEGIN
                IF TG_OP = 'UPDATE' AND
                   (OLD.role <> 'OWNER' OR NEW.role = 'OWNER') THEN
                    RETURN NULL;
                END IF;

                UPDATE workspaces
                SET updated_at = updated_at
                WHERE id = OLD.workspace_id;

                IF NOT FOUND THEN
                    RETURN NULL;
                END IF;

                IF NOT EXISTS (
                    SELECT 1
                    FROM workspace_members
                    WHERE workspace_id = OLD.workspace_id
                      AND role = 'OWNER'
                ) THEN
                    RAISE EXCEPTION USING
                        ERRCODE = '23514',
                        CONSTRAINT = 'ck_workspace_members_at_least_one_owner',
                        MESSAGE = 'A workspace must keep at least one owner';
                END IF;

                RETURN NULL;
            END;
            $$;

            CREATE CONSTRAINT TRIGGER ck_workspace_members_at_least_one_owner
            AFTER DELETE OR UPDATE ON workspace_members
            DEFERRABLE INITIALLY DEFERRED
            FOR EACH ROW
            EXECUTE FUNCTION ensure_workspace_has_owner();
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            DROP TRIGGER IF EXISTS ck_workspace_members_at_least_one_owner
            ON workspace_members;

            DROP FUNCTION IF EXISTS ensure_workspace_has_owner();
            """);
    }
}
