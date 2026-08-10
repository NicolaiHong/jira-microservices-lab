import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type {
  IssueRepository,
  NewIssueData,
  OutboxEvent,
  UpdateIssueData,
} from '../application/ports';
import { DomainError } from '../domain/errors';
import type {
  Issue,
  IssueComment,
  IssueHistory,
  IssuePriority,
  IssueStatus,
  IssueType,
} from '../domain/issue';
import { Database } from './database';

interface IssueRow {
  id: string;
  project_id: string;
  issue_number: number;
  issue_key: string;
  summary: string;
  description: string | null;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  reporter_user_id: string;
  assignee_user_id: string | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

interface CommentRow {
  id: string;
  issue_id: string;
  author_user_id: string;
  body: string;
  created_at: Date;
  updated_at: Date;
}

interface HistoryRow {
  id: string;
  issue_id: string;
  actor_user_id: string;
  action: string;
  from_value: unknown;
  to_value: unknown;
  created_at: Date;
}

interface OutboxRow {
  event_id: string;
  event_type: string;
  aggregate_id: string;
  aggregate_version: number;
  project_id: string;
  actor_user_id: string;
  payload: Record<string, unknown>;
  occurred_at: Date;
}

@Injectable()
export class PostgresIssueRepository implements IssueRepository {
  constructor(private readonly database: Database) {}

  createIssue(data: NewIssueData): Promise<Issue> {
    return this.database.transaction(async (client) => {
      const sequence = await client.query<{ last_number: number }>(
        `INSERT INTO project_issue_sequences (project_id, last_number)
         VALUES ($1, 1)
         ON CONFLICT (project_id)
         DO UPDATE SET last_number = project_issue_sequences.last_number + 1
         RETURNING last_number`,
        [data.projectId],
      );
      const number = sequence.rows[0].last_number;
      const id = randomUUID();
      const key = `${data.projectKey}-${number}`;
      const now = new Date();
      const result = await client.query<IssueRow>(
        `INSERT INTO issues (
           id, project_id, issue_number, issue_key, summary, description,
           type, priority, status, reporter_user_id, assignee_user_id,
           version, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'TODO',$9,$10,1,$11,$11)
         RETURNING *`,
        [
          id,
          data.projectId,
          number,
          key,
          data.summary,
          data.description,
          data.type,
          data.priority,
          data.reporterUserId,
          data.assigneeUserId,
          now,
        ],
      );
      const issue = this.toIssue(result.rows[0]);
      await this.insertHistory(client, issue, data.reporterUserId, 'CREATED', null, {
        key: issue.key,
        summary: issue.summary,
        type: issue.type,
        priority: issue.priority,
        status: issue.status,
        assigneeUserId: issue.assigneeUserId,
      });
      await this.insertEvent(client, issue, data.reporterUserId, 'issue.created', {
        issueKey: issue.key,
        summary: issue.summary,
        reporterUserId: issue.reporterUserId,
        assigneeUserId: issue.assigneeUserId,
        recipientUserIds: this.recipients(
          [issue.assigneeUserId],
          data.reporterUserId,
        ),
      });
      return issue;
    });
  }

  async listIssues(projectId: string): Promise<Issue[]> {
    const result = await this.database.query<IssueRow>(
      `SELECT * FROM issues WHERE project_id = $1
       ORDER BY issue_number DESC`,
      [projectId],
    );
    return result.rows.map((row) => this.toIssue(row));
  }

  async findIssue(issueId: string): Promise<Issue | null> {
    const result = await this.database.query<IssueRow>(
      'SELECT * FROM issues WHERE id = $1',
      [issueId],
    );
    return result.rows[0] ? this.toIssue(result.rows[0]) : null;
  }

  updateIssue(
    issue: Issue,
    data: UpdateIssueData,
    actorUserId: string,
  ): Promise<Issue> {
    return this.database.transaction(async (client) => {
      const updated = await this.updateWithVersion(
        client,
        issue,
        `summary = $1, description = $2, type = $3, priority = $4`,
        [data.summary, data.description, data.type, data.priority],
      );
      const fromValue = {
        summary: issue.summary,
        description: issue.description,
        type: issue.type,
        priority: issue.priority,
      };
      const toValue = {
        summary: updated.summary,
        description: updated.description,
        type: updated.type,
        priority: updated.priority,
      };
      await this.insertHistory(client, updated, actorUserId, 'UPDATED', fromValue, toValue);
      await this.insertEvent(client, updated, actorUserId, 'issue.updated', {
        issueKey: updated.key,
        changes: { from: fromValue, to: toValue },
        recipientUserIds: this.recipients(
          [updated.reporterUserId, updated.assigneeUserId],
          actorUserId,
        ),
      });
      return updated;
    });
  }

  assignIssue(
    issue: Issue,
    assigneeUserId: string | null,
    actorUserId: string,
  ): Promise<Issue> {
    return this.database.transaction(async (client) => {
      const updated = await this.updateWithVersion(
        client,
        issue,
        'assignee_user_id = $1',
        [assigneeUserId],
      );
      await this.insertHistory(
        client,
        updated,
        actorUserId,
        'ASSIGNEE_CHANGED',
        { assigneeUserId: issue.assigneeUserId },
        { assigneeUserId },
      );
      await this.insertEvent(client, updated, actorUserId, 'issue.assigned', {
        issueKey: updated.key,
        previousAssigneeUserId: issue.assigneeUserId,
        assigneeUserId,
        recipientUserIds: this.recipients(
          [updated.reporterUserId, assigneeUserId],
          actorUserId,
        ),
      });
      return updated;
    });
  }

  transitionIssue(
    issue: Issue,
    status: string,
    actorUserId: string,
  ): Promise<Issue> {
    return this.database.transaction(async (client) => {
      const updated = await this.updateWithVersion(
        client,
        issue,
        'status = $1',
        [status],
      );
      await this.insertHistory(
        client,
        updated,
        actorUserId,
        'STATUS_CHANGED',
        { status: issue.status },
        { status },
      );
      await this.insertEvent(client, updated, actorUserId, 'issue.transitioned', {
        issueKey: updated.key,
        fromStatus: issue.status,
        toStatus: status,
        recipientUserIds: this.recipients(
          [updated.reporterUserId, updated.assigneeUserId],
          actorUserId,
        ),
      });
      return updated;
    });
  }

  addComment(
    issue: Issue,
    authorUserId: string,
    body: string,
  ): Promise<IssueComment> {
    return this.database.transaction(async (client) => {
      const updatedIssue = await this.updateWithVersion(
        client,
        issue,
        'summary = summary',
        [],
      );
      const now = new Date();
      const result = await client.query<CommentRow>(
        `INSERT INTO issue_comments (
           id, issue_id, author_user_id, body, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$5) RETURNING *`,
        [randomUUID(), issue.id, authorUserId, body, now],
      );
      const comment = this.toComment(result.rows[0]);
      await this.insertHistory(
        client,
        updatedIssue,
        authorUserId,
        'COMMENT_ADDED',
        null,
        { commentId: comment.id },
      );
      await this.insertEvent(client, updatedIssue, authorUserId, 'issue.commented', {
        issueKey: issue.key,
        commentId: comment.id,
        commentPreview: body.slice(0, 160),
        recipientUserIds: this.recipients(
          [issue.reporterUserId, issue.assigneeUserId],
          authorUserId,
        ),
      });
      return comment;
    });
  }

  async listComments(issueId: string): Promise<IssueComment[]> {
    const result = await this.database.query<CommentRow>(
      `SELECT * FROM issue_comments WHERE issue_id = $1 ORDER BY created_at`,
      [issueId],
    );
    return result.rows.map((row) => this.toComment(row));
  }

  async listHistory(issueId: string): Promise<IssueHistory[]> {
    const result = await this.database.query<HistoryRow>(
      `SELECT * FROM issue_history WHERE issue_id = $1 ORDER BY created_at`,
      [issueId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      issueId: row.issue_id,
      actorUserId: row.actor_user_id,
      action: row.action,
      fromValue: row.from_value,
      toValue: row.to_value,
      createdAt: row.created_at,
    }));
  }

  async pendingEvents(limit: number): Promise<OutboxEvent[]> {
    const result = await this.database.query<OutboxRow>(
      `SELECT event_id, event_type, aggregate_id, aggregate_version,
              project_id, actor_user_id, payload, occurred_at
       FROM outbox_events
       WHERE published_at IS NULL AND publish_attempts < 20
       ORDER BY occurred_at
       LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => ({
      eventId: row.event_id,
      eventType: row.event_type,
      aggregateId: row.aggregate_id,
      aggregateVersion: row.aggregate_version,
      projectId: row.project_id,
      actorUserId: row.actor_user_id,
      occurredAt: row.occurred_at.toISOString(),
      payload: row.payload,
    }));
  }

  async markEventPublished(eventId: string): Promise<void> {
    await this.database.query(
      `UPDATE outbox_events SET published_at = NOW() WHERE event_id = $1`,
      [eventId],
    );
  }

  async recordPublishFailure(eventId: string): Promise<void> {
    await this.database.query(
      `UPDATE outbox_events SET publish_attempts = publish_attempts + 1
       WHERE event_id = $1`,
      [eventId],
    );
  }

  private async updateWithVersion(
    client: PoolClient,
    issue: Issue,
    setters: string,
    values: unknown[],
  ): Promise<Issue> {
    const parameterOffset = values.length;
    const result = await client.query<IssueRow>(
      `UPDATE issues
       SET ${setters}, version = version + 1, updated_at = NOW()
       WHERE id = $${parameterOffset + 1} AND version = $${parameterOffset + 2}
       RETURNING *`,
      [...values, issue.id, issue.version],
    );
    if (!result.rows[0]) {
      throw new DomainError(
        409,
        'CONCURRENT_ISSUE_MODIFICATION',
        'Issue changed while the request was being processed; retry the request',
      );
    }
    return this.toIssue(result.rows[0]);
  }

  private async insertHistory(
    client: PoolClient,
    issue: Issue,
    actorUserId: string,
    action: string,
    fromValue: unknown,
    toValue: unknown,
  ): Promise<void> {
    await client.query(
      `INSERT INTO issue_history (
         id, issue_id, actor_user_id, action, from_value, to_value, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [randomUUID(), issue.id, actorUserId, action, fromValue, toValue, new Date()],
    );
  }

  private async insertEvent(
    client: PoolClient,
    issue: Issue,
    actorUserId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await client.query(
      `INSERT INTO outbox_events (
         event_id, event_type, schema_version, aggregate_id,
         aggregate_version, project_id, actor_user_id, payload, occurred_at
       ) VALUES ($1,$2,1,$3,$4,$5,$6,$7,$8)`,
      [
        randomUUID(),
        eventType,
        issue.id,
        issue.version,
        issue.projectId,
        actorUserId,
        payload,
        new Date(),
      ],
    );
  }

  private recipients(
    values: Array<string | null>,
    actorUserId: string,
  ): string[] {
    return [...new Set(values.filter((value): value is string => !!value))].filter(
      (value) => value !== actorUserId,
    );
  }

  private toIssue(row: IssueRow): Issue {
    return {
      id: row.id,
      projectId: row.project_id,
      number: row.issue_number,
      key: row.issue_key,
      summary: row.summary,
      description: row.description,
      type: row.type,
      priority: row.priority,
      status: row.status,
      reporterUserId: row.reporter_user_id,
      assigneeUserId: row.assignee_user_id,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toComment(row: CommentRow): IssueComment {
    return {
      id: row.id,
      issueId: row.issue_id,
      authorUserId: row.author_user_id,
      body: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
