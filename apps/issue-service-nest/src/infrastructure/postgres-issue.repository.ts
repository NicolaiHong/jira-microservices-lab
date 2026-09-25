import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { context, propagation } from '@opentelemetry/api';
import type { PoolClient } from 'pg';
import type {
  ClaimedOutboxEvent,
  IssueListFilter,
  IssueListPage,
  IssueListPosition,
  IssueRepository,
  NewIssueData,
  OutboxStatus,
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
  ValidatedIssueTransition,
} from '../domain/issue';
import { Database } from './database';

export const OUTBOX_MAX_PUBLISH_ATTEMPTS = 20;
export const OUTBOX_CLAIM_LEASE_SECONDS = 30;

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
  epic_id: string | null;
  sprint_id: string | null;
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
  trace_context: Record<string, string> | null;
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
           type, priority, status, reporter_user_id, assignee_user_id, epic_id, sprint_id,
           version, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'TODO',$9,$10,$11,$12,1,$13,$13)
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
          data.epicId,
          data.sprintId,
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

  async listIssues(
    projectId: string,
    filter: IssueListFilter,
    after: IssueListPosition | null,
    limit: number,
  ): Promise<IssueListPage> {
    // Keyset page over the immutable (created_at, id) order (ADR 0005). The
    // position is formatted by PostgreSQL because a JS Date drops microseconds.
    const values: unknown[] = [projectId];
    const param = (value: unknown) => `$${values.push(value)}`;
    const where = ['project_id = $1'];
    if (filter.status) where.push(`status = ${param(filter.status)}`);
    if (filter.assigneeUserId) where.push(`assignee_user_id = ${param(filter.assigneeUserId)}`);
    if (filter.sprintId) where.push(`sprint_id = ${param(filter.sprintId)}`);
    if (filter.q) {
      // Backslash is ILIKE's default escape character.
      where.push(`summary ILIKE '%' || ${param(filter.q.replace(/[\\%_]/g, '\\$&'))} || '%'`);
    }
    if (after) {
      where.push(
        `(created_at, id) < (${param(after.createdAt)}::timestamptz, ${param(after.id)}::uuid)`,
      );
    }
    const result = await this.database.query<IssueRow & { position_created_at: string }>(
      `SELECT *,
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS position_created_at
       FROM issues
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT ${param(limit + 1)}`,
      values,
    );
    const rows = result.rows.slice(0, limit);
    const last = rows[rows.length - 1];
    return {
      items: rows.map((row) => this.toIssue(row)),
      next:
        result.rows.length > limit
          ? { createdAt: last.position_created_at, id: last.id }
          : null,
    };
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
    expectedVersion: number,
    data: UpdateIssueData,
    actorUserId: string,
  ): Promise<Issue> {
    return this.database.transaction(async (client) => {
      const updated = await this.updateWithVersion(
        client,
        issue,
        expectedVersion,
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
    expectedVersion: number,
    assigneeUserId: string | null,
    actorUserId: string,
  ): Promise<Issue> {
    return this.database.transaction(async (client) => {
      const updated = await this.updateWithVersion(
        client,
        issue,
        expectedVersion,
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
    expectedVersion: number,
    transition: ValidatedIssueTransition,
    actorUserId: string,
  ): Promise<Issue> {
    return this.database.transaction(async (client) => {
      const updated = await this.updateWithVersion(
        client,
        issue,
        expectedVersion,
        'status = $1',
        [transition.to],
      );
      await this.insertHistory(
        client,
        updated,
        actorUserId,
        'STATUS_CHANGED',
        { status: transition.from },
        { status: transition.to },
      );
      await this.insertEvent(client, updated, actorUserId, 'issue.transitioned', {
        issueKey: updated.key,
        fromStatus: transition.from,
        toStatus: transition.to,
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
        issue.version,
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
      `SELECT * FROM issue_comments
       WHERE issue_id = $1
       ORDER BY created_at ASC, id ASC`,
      [issueId],
    );
    return result.rows.map((row) => this.toComment(row));
  }

  async listHistory(issueId: string): Promise<IssueHistory[]> {
    const result = await this.database.query<HistoryRow>(
      `SELECT * FROM issue_history
       WHERE issue_id = $1
       ORDER BY created_at ASC, id ASC`,
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

  async claimPendingEvents(limit: number): Promise<ClaimedOutboxEvent[]> {
    // Leases due events that have no earlier unpublished event for the same
    // aggregate (ADR 0004). The lease exceeds a Kafka send, so no transaction
    // stays open while publishing; an expired lease makes the event due again.
    // ponytail: one event per aggregate per poll; drain in a loop if bursts on
    // a single issue lag.
    const result = await this.database.query<OutboxRow>(
      `UPDATE outbox_events
       SET next_attempt_at = NOW() + $3 * INTERVAL '1 second'
       WHERE event_id IN (
         SELECT candidate.event_id
         FROM outbox_events candidate
         WHERE candidate.published_at IS NULL
           AND candidate.publish_attempts < $2
           AND candidate.next_attempt_at <= NOW()
           AND NOT EXISTS (
             SELECT 1 FROM outbox_events earlier
             WHERE earlier.aggregate_id = candidate.aggregate_id
               AND earlier.published_at IS NULL
               AND earlier.aggregate_version < candidate.aggregate_version
           )
         ORDER BY candidate.occurred_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING event_id, event_type, aggregate_id, aggregate_version,
                 project_id, actor_user_id, payload, occurred_at, trace_context`,
      [limit, OUTBOX_MAX_PUBLISH_ATTEMPTS, OUTBOX_CLAIM_LEASE_SECONDS],
    );
    return result.rows
      .sort(
        (a, b) =>
          a.occurred_at.getTime() - b.occurred_at.getTime() ||
          a.event_id.localeCompare(b.event_id),
      )
      .map((row) => ({
        eventId: row.event_id,
        eventType: row.event_type,
        aggregateId: row.aggregate_id,
        aggregateVersion: row.aggregate_version,
        projectId: row.project_id,
        actorUserId: row.actor_user_id,
        occurredAt: row.occurred_at.toISOString(),
        payload: row.payload,
        traceContext: row.trace_context,
      }));
  }

  async markEventsPublished(eventIds: string[]): Promise<void> {
    await this.database.query(
      `UPDATE outbox_events SET published_at = NOW() WHERE event_id = ANY($1::uuid[])`,
      [eventIds],
    );
  }

  async recordPublishFailure(
    eventId: string,
    error: string,
  ): Promise<{ attempts: number; abandoned: boolean }> {
    // Backoff doubles from 1 s per attempt and is capped at 5 minutes, so the
    // attempt budget spans roughly an hour of broker unavailability.
    const result = await this.database.query<{ publish_attempts: number }>(
      `UPDATE outbox_events
       SET publish_attempts = publish_attempts + 1,
           last_error = LEFT($2, 1000),
           next_attempt_at = NOW() + LEAST(
             POWER(2, LEAST(publish_attempts, 20)) * INTERVAL '1 second',
             INTERVAL '5 minutes'
           )
       WHERE event_id = $1
       RETURNING publish_attempts`,
      [eventId, error],
    );
    const attempts = result.rows[0]?.publish_attempts ?? 0;
    return { attempts, abandoned: attempts >= OUTBOX_MAX_PUBLISH_ATTEMPTS };
  }

  async outboxStatus(): Promise<OutboxStatus> {
    const result = await this.database.query<{
      pending: string;
      abandoned: string;
      oldest_pending_seconds: number | null;
    }>(
      `SELECT
         count(*) FILTER (WHERE publish_attempts < $1) AS pending,
         count(*) FILTER (WHERE publish_attempts >= $1) AS abandoned,
         floor(EXTRACT(EPOCH FROM NOW() - min(occurred_at) FILTER (WHERE publish_attempts < $1)))::int
           AS oldest_pending_seconds
       FROM outbox_events
       WHERE published_at IS NULL`,
      [OUTBOX_MAX_PUBLISH_ATTEMPTS],
    );
    const row = result.rows[0];
    return {
      pending: Number(row.pending),
      abandoned: Number(row.abandoned),
      oldestPendingSeconds: row.oldest_pending_seconds,
    };
  }

  private async updateWithVersion(
    client: PoolClient,
    issue: Issue,
    expectedVersion: number,
    setters: string,
    values: unknown[],
  ): Promise<Issue> {
    const parameterOffset = values.length;
    const result = await client.query<IssueRow>(
      `UPDATE issues
       SET ${setters}, version = version + 1, updated_at = NOW()
       WHERE id = $${parameterOffset + 1} AND version = $${parameterOffset + 2}
       RETURNING *`,
      [...values, issue.id, expectedVersion],
    );
    if (!result.rows[0]) {
      throw new DomainError(
        409,
        'CONCURRENT_ISSUE_MODIFICATION',
        'Issue changed since it was last loaded',
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
    // The publisher restores this context so the Kafka send joins the
    // request's trace (ADR 0006); it stays empty when tracing is off.
    const traceContext: Record<string, string> = {};
    propagation.inject(context.active(), traceContext);
    await client.query(
      `INSERT INTO outbox_events (
         event_id, event_type, schema_version, aggregate_id,
         aggregate_version, project_id, actor_user_id, payload, occurred_at,
         trace_context
       ) VALUES ($1,$2,1,$3,$4,$5,$6,$7,$8,$9)`,
      [
        randomUUID(),
        eventType,
        issue.id,
        issue.version,
        issue.projectId,
        actorUserId,
        payload,
        new Date(),
        Object.keys(traceContext).length > 0 ? traceContext : null,
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
      epicId: row.epic_id,
      sprintId: row.sprint_id,
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
