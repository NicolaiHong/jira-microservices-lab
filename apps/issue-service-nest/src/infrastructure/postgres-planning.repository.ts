import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { NewEpicData, NewSprintData, PlanningRepository } from '../application/ports';
import type { Epic, EpicColor, Sprint, SprintStatus } from '../domain/planning';
import { Database } from './database';

interface EpicRow {
  id: string;
  project_id: string;
  name: string;
  color: EpicColor;
  start_date: string | null;
  target_date: string | null;
  created_at: Date;
  updated_at: Date;
}

interface SprintRow {
  id: string;
  project_id: string;
  name: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
  status: SprintStatus;
  created_at: Date;
  completed_at: Date | null;
}

@Injectable()
export class PostgresPlanningRepository implements PlanningRepository {
  constructor(private readonly database: Database) {}

  async createEpic(data: NewEpicData): Promise<Epic> {
    const now = new Date();
    const result = await this.database.query<EpicRow>(
      `INSERT INTO epics (id, project_id, name, color, start_date, target_date, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *`,
      [randomUUID(), data.projectId, data.name, data.color, data.startDate, data.targetDate, now],
    );
    return this.toEpic(result.rows[0]);
  }

  async listEpics(projectId: string): Promise<Epic[]> {
    const result = await this.database.query<EpicRow>(
      'SELECT * FROM epics WHERE project_id = $1 ORDER BY start_date NULLS LAST, created_at',
      [projectId],
    );
    return result.rows.map((row) => this.toEpic(row));
  }

  async findEpic(epicId: string): Promise<Epic | null> {
    const result = await this.database.query<EpicRow>('SELECT * FROM epics WHERE id = $1', [epicId]);
    return result.rows[0] ? this.toEpic(result.rows[0]) : null;
  }

  async updateEpic(epic: Epic, data: Omit<NewEpicData, 'projectId'>): Promise<Epic> {
    const result = await this.database.query<EpicRow>(
      `UPDATE epics SET name = $1, color = $2, start_date = $3, target_date = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [data.name, data.color, data.startDate, data.targetDate, epic.id],
    );
    return this.toEpic(result.rows[0]);
  }

  async createSprint(data: NewSprintData): Promise<Sprint> {
    const now = new Date();
    const result = await this.database.query<SprintRow>(
      `INSERT INTO sprints (id, project_id, name, goal, start_date, end_date, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE',$7) RETURNING *`,
      [randomUUID(), data.projectId, data.name, data.goal, data.startDate, data.endDate, now],
    );
    return this.toSprint(result.rows[0]);
  }

  async listSprints(projectId: string): Promise<Sprint[]> {
    const result = await this.database.query<SprintRow>(
      `SELECT * FROM sprints WHERE project_id = $1
       ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END, created_at DESC`,
      [projectId],
    );
    return result.rows.map((row) => this.toSprint(row));
  }

  async findSprint(sprintId: string): Promise<Sprint | null> {
    const result = await this.database.query<SprintRow>('SELECT * FROM sprints WHERE id = $1', [sprintId]);
    return result.rows[0] ? this.toSprint(result.rows[0]) : null;
  }

  async completeSprint(sprint: Sprint): Promise<Sprint> {
    const result = await this.database.query<SprintRow>(
      `UPDATE sprints SET status = 'COMPLETED', completed_at = NOW()
       WHERE id = $1 AND status = 'ACTIVE' RETURNING *`,
      [sprint.id],
    );
    return this.toSprint(result.rows[0]);
  }

  private toEpic(row: EpicRow): Epic {
    return { id: row.id, projectId: row.project_id, name: row.name, color: row.color, startDate: row.start_date, targetDate: row.target_date, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  private toSprint(row: SprintRow): Sprint {
    return { id: row.id, projectId: row.project_id, name: row.name, goal: row.goal, startDate: row.start_date, endDate: row.end_date, status: row.status, createdAt: row.created_at, completedAt: row.completed_at };
  }
}
