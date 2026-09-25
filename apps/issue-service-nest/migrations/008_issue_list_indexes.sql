-- Paged project issue list (ADR 0005). Every index ends with the
-- (created_at, id) keyset, so a filtered page is one ordered range scan.
CREATE INDEX IF NOT EXISTS ix_issues_project_created
    ON issues(project_id, created_at, id);
CREATE INDEX IF NOT EXISTS ix_issues_project_status_created
    ON issues(project_id, status, created_at, id);
CREATE INDEX IF NOT EXISTS ix_issues_project_assignee_created
    ON issues(project_id, assignee_user_id, created_at, id);
CREATE INDEX IF NOT EXISTS ix_issues_project_sprint_created
    ON issues(project_id, sprint_id, created_at, id);

-- Substring match for the q filter (summary ILIKE '%...%').
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS ix_issues_summary_trgm
    ON issues USING gin (summary gin_trgm_ops);
