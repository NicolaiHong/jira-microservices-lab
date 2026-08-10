ALTER TABLE issues
    DROP CONSTRAINT IF EXISTS ux_issues_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_issues_project_key
    ON issues(project_id, issue_key);
