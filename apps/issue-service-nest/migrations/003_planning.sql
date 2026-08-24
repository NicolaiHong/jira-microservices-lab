CREATE TABLE IF NOT EXISTS epics (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    name VARCHAR(120) NOT NULL,
    color VARCHAR(20) NOT NULL CHECK (color IN ('PURPLE', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE')),
    start_date DATE,
    target_date DATE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CHECK (start_date IS NULL OR target_date IS NULL OR start_date <= target_date)
);

CREATE INDEX IF NOT EXISTS ix_epics_project_id ON epics(project_id);

CREATE TABLE IF NOT EXISTS sprints (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    name VARCHAR(120) NOT NULL,
    goal VARCHAR(500),
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'COMPLETED')),
    created_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_sprints_one_active_project
    ON sprints(project_id)
    WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS ix_sprints_project_id ON sprints(project_id);

ALTER TABLE issues ADD COLUMN IF NOT EXISTS epic_id UUID REFERENCES epics(id) ON DELETE SET NULL;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_issues_epic_id ON issues(epic_id);
CREATE INDEX IF NOT EXISTS ix_issues_sprint_id ON issues(sprint_id);
