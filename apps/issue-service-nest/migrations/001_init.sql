CREATE TABLE IF NOT EXISTS project_issue_sequences (
    project_id UUID PRIMARY KEY,
    last_number INTEGER NOT NULL CHECK (last_number > 0)
);

CREATE TABLE IF NOT EXISTS issues (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    issue_number INTEGER NOT NULL CHECK (issue_number > 0),
    issue_key VARCHAR(50) NOT NULL,
    summary VARCHAR(200) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('TASK', 'BUG', 'STORY')),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status VARCHAR(30) NOT NULL CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE')),
    reporter_user_id UUID NOT NULL,
    assignee_user_id UUID,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ux_issues_project_number UNIQUE (project_id, issue_number),
    CONSTRAINT ux_issues_project_key UNIQUE (project_id, issue_key)
);

CREATE INDEX IF NOT EXISTS ix_issues_project_id ON issues(project_id);
CREATE INDEX IF NOT EXISTS ix_issues_assignee_user_id ON issues(assignee_user_id);

CREATE TABLE IF NOT EXISTS issue_comments (
    id UUID PRIMARY KEY,
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_issue_comments_issue_id_created_at
    ON issue_comments(issue_id, created_at);

CREATE TABLE IF NOT EXISTS issue_history (
    id UUID PRIMARY KEY,
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    actor_user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    from_value JSONB,
    to_value JSONB,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_issue_history_issue_id_created_at
    ON issue_history(issue_id, created_at);

CREATE TABLE IF NOT EXISTS outbox_events (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    aggregate_id UUID NOT NULL,
    aggregate_version INTEGER NOT NULL,
    project_id UUID NOT NULL,
    actor_user_id UUID NOT NULL,
    payload JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    published_at TIMESTAMPTZ,
    publish_attempts INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_outbox_events_pending
    ON outbox_events(occurred_at)
    WHERE published_at IS NULL;
