import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { context, propagation, ROOT_CONTEXT } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { node } from '@opentelemetry/sdk-node';
import { Pool } from 'pg';
import { IssueApplicationService } from '../application/issue-application.service';
import { PlanningApplicationService } from '../application/planning-application.service';
import type {
  NewIssueData,
  PlanningRepository,
  ProjectAccessPort,
} from '../application/ports';
import { DomainError } from '../domain/errors';
import type { Issue } from '../domain/issue';
import { assertContract } from '../testing/contracts';
import { Database } from './database';
import { OutboxPublisher } from './outbox.publisher';
import { PostgresIssueRepository } from './postgres-issue.repository';
import { PostgresPlanningRepository } from './postgres-planning.repository';

const testDatabaseUrl = process.env.ISSUE_SERVICE_TEST_DATABASE_URL;
const reporterUserId = '11111111-1111-4111-8111-111111111111';
const requestContext = {
  userId: reporterUserId,
  correlationId: 'issue-postgres-lifecycle-test',
};

test(
  'PostgreSQL Issue lifecycle concurrency and atomicity',
  { skip: testDatabaseUrl ? false : 'ISSUE_SERVICE_TEST_DATABASE_URL is not set' },
  async (t) => {
    assertDisposableTestDatabaseUrl(testDatabaseUrl!);

    const originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = testDatabaseUrl;
    const admin = new Pool({ connectionString: testDatabaseUrl });
    const database = new Database();

    t.after(async () => {
      await database.onModuleDestroy();
      await resetSchema(admin);
      await admin.end();
      if (originalDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = originalDatabaseUrl;
      }
    });

    await t.test('stops the migration when legacy descriptions violate the database constraint', async () => {
      await resetSchema(admin);
      await applyMigrations(admin, [
        '001_init.sql',
        '002_scope_issue_key_to_project.sql',
        '003_planning.sql',
      ]);
      await admin.query(
        `INSERT INTO issues (
          id, project_id, issue_number, issue_key, summary, description,
          type, priority, status, reporter_user_id, version, created_at, updated_at
        ) VALUES ($1,$2,1,'LEGACY-1','Legacy issue',$3,'TASK','LOW','TODO',$4,1,NOW(),NOW())`,
        [randomUUID(), randomUUID(), 'x'.repeat(5001), reporterUserId],
      );

      await assert.rejects(
        applyMigrations(admin, ['004_issue_core_hardening.sql']),
        /Cannot apply 004_issue_core_hardening/,
      );
    });

    await t.test('stops comment hardening after a read-only legacy audit reports only identifiers and lengths', async () => {
      await resetSchema(admin);
      await applyMigrations(admin, [
        '001_init.sql',
        '002_scope_issue_key_to_project.sql',
        '003_planning.sql',
        '004_issue_core_hardening.sql',
      ]);
      const issueId = randomUUID();
      const commentId = randomUUID();
      const invalidBody = ' \t\n ';
      await admin.query(
        `INSERT INTO issues (
          id, project_id, issue_number, issue_key, summary, description,
          type, priority, status, reporter_user_id, version, created_at, updated_at
        ) VALUES ($1,$2,1,'LEGACY-COMMENT-1','Legacy issue',NULL,'TASK','LOW','TODO',$3,1,NOW(),NOW())`,
        [issueId, randomUUID(), reporterUserId],
      );
      await admin.query(
        `INSERT INTO issue_comments (
          id, issue_id, author_user_id, body, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,NOW(),NOW())`,
        [commentId, issueId, reporterUserId, invalidBody],
      );

      await assert.rejects(
        applyMigrations(admin, ['005_comment_activity_hardening.sql']),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(
            error.message,
            `Cannot apply 005_comment_activity_hardening: invalid issue_comments (id:length): ${commentId}:${invalidBody.length}`,
          );
          return true;
        },
      );

      const legacyRows = await admin.query<{ id: string; body_length: number }>(
        `SELECT id, char_length(body) AS body_length
         FROM issue_comments
         WHERE id = $1`,
        [commentId],
      );
      assert.deepEqual(legacyRows.rows, [
        { id: commentId, body_length: invalidBody.length },
      ]);
      const constraints = await admin.query<{ conname: string }>(
        `SELECT conname
         FROM pg_constraint
         WHERE conrelid = 'issue_comments'::regclass
           AND conname IN (
             'chk_issue_comments_body_nonblank',
             'chk_issue_comments_body_length'
           )`,
      );
      assert.deepEqual(constraints.rows, []);
    });

    await resetSchema(admin);
    await database.onModuleInit();
    const repository = new PostgresIssueRepository(database);
    const application = issueApplication(repository);

    await t.test('enforces the description length at the database boundary', async () => {
      await assert.rejects(
        database.query(
          `INSERT INTO issues (
             id, project_id, issue_number, issue_key, summary, description,
             type, priority, status, reporter_user_id, version, created_at, updated_at
           ) VALUES ($1,$2,1,'LIMIT-1','Too long',$3,'TASK','LOW','TODO',$4,1,NOW(),NOW())`,
          [randomUUID(), randomUUID(), 'x'.repeat(5001), reporterUserId],
        ),
        (error: unknown) => isPostgresCheckViolation(error),
      );
    });

    await t.test('enforces nonblank whitespace and maximum-length comment constraints at the database boundary', async () => {
      const initial = await repository.createIssue(
        newIssue(randomUUID(), 'Comment constraint checks'),
      );

      for (const body of [' ', '     ', '\t', '\n', '\r\n', ' \t\n ', 'x'.repeat(5001)]) {
        await assert.rejects(
          database.query(
            `INSERT INTO issue_comments (
              id, issue_id, author_user_id, body, created_at, updated_at
            ) VALUES ($1,$2,$3,$4,NOW(),NOW())`,
            [randomUUID(), initial.id, reporterUserId, body],
          ),
          (error: unknown) => isPostgresCheckViolation(error),
        );
      }

      await assert.doesNotReject(
        database.query(
          `INSERT INTO issue_comments (
            id, issue_id, author_user_id, body, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,NOW(),NOW())`,
          [randomUUID(), initial.id, reporterUserId, 'x'.repeat(5000)],
        ),
      );
    });

    await t.test('atomically commits one normalized comment, version, history, and outbox event', async () => {
      const initial = await repository.createIssue(
        newIssue(randomUUID(), 'Atomic comment'),
      );
      const body = 'x'.repeat(200);
      const result = await application.addComment(
        initial.id,
        { body: `  ${body}  ` },
        requestContext,
      );

      assert.equal(result.comment.body, body);
      const effects = await database.query<{
        version: number;
        comment_count: string;
        history_count: string;
        outbox_count: string;
      }>(
        `SELECT
          i.version,
          (SELECT count(*) FROM issue_comments WHERE issue_id = i.id) AS comment_count,
          (SELECT count(*) FROM issue_history WHERE issue_id = i.id AND action = 'COMMENT_ADDED') AS history_count,
          (SELECT count(*) FROM outbox_events WHERE aggregate_id = i.id AND event_type = 'issue.commented') AS outbox_count
         FROM issues i
         WHERE i.id = $1`,
        [initial.id],
      );
      assert.deepEqual(effects.rows[0], {
        version: initial.version + 1,
        comment_count: '1',
        history_count: '1',
        outbox_count: '1',
      });

      const history = await database.query<{ to_value: { commentId: string } }>(
        `SELECT to_value
         FROM issue_history
         WHERE issue_id = $1 AND action = 'COMMENT_ADDED'`,
        [initial.id],
      );
      assert.deepEqual(history.rows[0].to_value, { commentId: result.comment.id });

      const outbox = await database.query<{
        aggregate_version: number;
        payload: { commentId: string; commentPreview: string };
      }>(
        `SELECT aggregate_version, payload
         FROM outbox_events
         WHERE aggregate_id = $1 AND event_type = 'issue.commented'`,
        [initial.id],
      );
      assert.equal(outbox.rows[0].aggregate_version, initial.version + 1);
      assert.equal(outbox.rows[0].payload.commentId, result.comment.id);
      assert.equal(outbox.rows[0].payload.commentPreview, body.slice(0, 160));
      assert.equal(outbox.rows[0].payload.commentPreview.length, 160);
    });

    await t.test('allocates unique project numbers and keys under concurrent creation', async () => {
      const projectId = randomUUID();
      const created = await Promise.all(
        Array.from({ length: 40 }, (_, index) =>
          repository.createIssue(newIssue(projectId, `Concurrent issue ${index}`)),
        ),
      );
      const numbers = created
        .map((item) => item.number)
        .sort((left, right) => left - right);
      const keys = new Set(created.map((item) => item.key));
      assert.deepEqual(
        numbers,
        Array.from({ length: 40 }, (_, index) => index + 1),
      );
      assert.equal(keys.size, 40);
      const sequence = await database.query<{ last_number: number }>(
        'SELECT last_number FROM project_issue_sequences WHERE project_id = $1',
        [projectId],
      );
      assert.equal(sequence.rows[0].last_number, 40);
    });

    await t.test('allows exactly one same-version TODO to IN_PROGRESS transition', async () => {
      const initial = await repository.createIssue(
        newIssue(randomUUID(), 'Concurrent transition'),
      );
      const body = { status: 'IN_PROGRESS', expectedVersion: initial.version };
      const concurrentApplication = issueApplication(
        repository,
        activeProjectAccess(createTwoRequestBarrier()),
      );
      const outcomes = await Promise.allSettled([
        concurrentApplication.transitionIssue(initial.id, body, requestContext),
        concurrentApplication.transitionIssue(initial.id, body, requestContext),
      ]);

      const successes = outcomes.filter(
        (outcome): outcome is PromiseFulfilledResult<{ issue: Issue }> =>
          outcome.status === 'fulfilled',
      );
      assert.equal(successes.length, 1);
      assert.equal(successes[0].value.issue.status, 'IN_PROGRESS');

      const failure = outcomes.find(
        (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
      );
      assert.ok(failure);
      assert.ok(failure.reason instanceof DomainError);
      assert.equal(failure.reason.status, 409);
      assert.equal(failure.reason.code, 'CONCURRENT_ISSUE_MODIFICATION');

      await assertTransitionState(
        database,
        initial.id,
        'IN_PROGRESS',
        initial.version + 1,
        { historyCount: '1', outboxCount: '1' },
      );
    });

    await t.test('allows exactly one of two comments that begin from the same Issue version', async () => {
      const initial = await repository.createIssue(
        newIssue(randomUUID(), 'Concurrent comments'),
      );
      const concurrentApplication = issueApplication(
        repository,
        activeProjectAccess(createTwoRequestBarrier()),
      );
      const outcomes = await Promise.allSettled([
        concurrentApplication.addComment(initial.id, { body: 'First comment' }, requestContext),
        concurrentApplication.addComment(initial.id, { body: 'Second comment' }, requestContext),
      ]);

      assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
      assertConcurrentIssueFailure(outcomes);
      await assertCommentState(
        database,
        initial.id,
        initial.version + 1,
        { commentCount: '1', historyCount: '1', outboxCount: '1' },
      );
    });

    await t.test('allows exactly one comment or core mutation that begin from the same Issue version', async () => {
      const initial = await repository.createIssue(
        newIssue(randomUUID(), 'Comment versus core mutation'),
      );
      const concurrentApplication = issueApplication(
        repository,
        activeProjectAccess(createTwoRequestBarrier()),
      );
      const outcomes = await Promise.allSettled([
        concurrentApplication.addComment(initial.id, { body: 'Concurrent comment' }, requestContext),
        concurrentApplication.updateIssue(
          initial.id,
          { summary: 'Concurrent core mutation', expectedVersion: initial.version },
          requestContext,
        ),
      ]);

      assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
      assertConcurrentIssueFailure(outcomes);
      const effects = await database.query<{
        version: number;
        comment_count: string;
        comment_history_count: string;
        update_history_count: string;
        comment_outbox_count: string;
        update_outbox_count: string;
      }>(
        `SELECT
          i.version,
          (SELECT count(*) FROM issue_comments WHERE issue_id = i.id) AS comment_count,
          (SELECT count(*) FROM issue_history WHERE issue_id = i.id AND action = 'COMMENT_ADDED') AS comment_history_count,
          (SELECT count(*) FROM issue_history WHERE issue_id = i.id AND action = 'UPDATED') AS update_history_count,
          (SELECT count(*) FROM outbox_events WHERE aggregate_id = i.id AND event_type = 'issue.commented') AS comment_outbox_count,
          (SELECT count(*) FROM outbox_events WHERE aggregate_id = i.id AND event_type = 'issue.updated') AS update_outbox_count
         FROM issues i
         WHERE i.id = $1`,
        [initial.id],
      );
      const persisted = effects.rows[0];
      assert.equal(persisted.version, initial.version + 1);
      if (persisted.comment_count === '1') {
        assert.deepEqual(
          {
            commentHistoryCount: persisted.comment_history_count,
            updateHistoryCount: persisted.update_history_count,
            commentOutboxCount: persisted.comment_outbox_count,
            updateOutboxCount: persisted.update_outbox_count,
          },
          {
            commentHistoryCount: '1',
            updateHistoryCount: '0',
            commentOutboxCount: '1',
            updateOutboxCount: '0',
          },
        );
      } else {
        assert.deepEqual(
          {
            commentCount: persisted.comment_count,
            commentHistoryCount: persisted.comment_history_count,
            updateHistoryCount: persisted.update_history_count,
            commentOutboxCount: persisted.comment_outbox_count,
            updateOutboxCount: persisted.update_outbox_count,
          },
          {
            commentCount: '0',
            commentHistoryCount: '0',
            updateHistoryCount: '1',
            commentOutboxCount: '0',
            updateOutboxCount: '1',
          },
        );
      }
    });

    await t.test('rejects an invalid transition with zero transition side effects', async () => {
      const initial = await repository.createIssue(
        newIssue(randomUUID(), 'Invalid transition'),
      );

      await assert.rejects(
        application.transitionIssue(
          initial.id,
          { status: 'DONE', expectedVersion: initial.version },
          requestContext,
        ),
        (error: unknown) =>
          error instanceof DomainError &&
          error.status === 409 &&
          error.code === 'INVALID_ISSUE_TRANSITION',
      );

      await assertTransitionState(
        database,
        initial.id,
        'TODO',
        initial.version,
        { historyCount: '0', outboxCount: '0' },
      );
    });

    await t.test('rolls back transition state and effects when status, history, or outbox persistence fails', async () => {
      await assertRollbackForStatusUpdateFailure(database, admin, repository, application);
      await assertRollbackForHistoryInsertFailure(database, admin, repository, application);
      await assertRollbackForOutboxInsertFailure(database, admin, repository, application);
    });

    await t.test('rolls back all comment effects when any local persistence step fails', async () => {
      await assertRollbackForCommentFailure(
        database,
        admin,
        repository,
        application,
        {
          name: 'issue_version_update',
          relation: 'issues',
          message: 'forced comment Issue version update failure',
          trigger: 'BEFORE UPDATE OF summary ON issues FOR EACH ROW',
        },
      );
      await assertRollbackForCommentFailure(
        database,
        admin,
        repository,
        application,
        {
          name: 'comment_insert',
          relation: 'issue_comments',
          message: 'forced comment insert failure',
          trigger: 'BEFORE INSERT ON issue_comments FOR EACH ROW',
        },
      );
      await assertRollbackForCommentFailure(
        database,
        admin,
        repository,
        application,
        {
          name: 'history_insert',
          relation: 'issue_history',
          message: 'forced comment history failure',
          trigger: "BEFORE INSERT ON issue_history FOR EACH ROW WHEN (NEW.action = 'COMMENT_ADDED')",
        },
      );
      await assertRollbackForCommentFailure(
        database,
        admin,
        repository,
        application,
        {
          name: 'outbox_insert',
          relation: 'outbox_events',
          message: 'forced comment outbox failure',
          trigger: "BEFORE INSERT ON outbox_events FOR EACH ROW WHEN (NEW.event_type = 'issue.commented')",
        },
      );
    });

    await t.test('lists comments and history oldest-first with deterministic ID tie breaking', async () => {
      const initial = await repository.createIssue(
        newIssue(randomUUID(), 'Deterministic comment and history ordering'),
      );
      const [firstCommentId, secondCommentId] = [randomUUID(), randomUUID()].sort();
      const [firstHistoryId, secondHistoryId] = [randomUUID(), randomUUID()].sort();
      const tiedAt = new Date('2099-01-01T00:00:00.000Z');

      await database.query(
        `INSERT INTO issue_comments (
          id, issue_id, author_user_id, body, created_at, updated_at
        ) VALUES
          ($1,$2,$3,'second', $4, $4),
          ($5,$2,$3,'first', $4, $4)`,
        [secondCommentId, initial.id, reporterUserId, tiedAt, firstCommentId],
      );
      await database.query(
        `INSERT INTO issue_history (
          id, issue_id, actor_user_id, action, from_value, to_value, created_at
        ) VALUES
          ($1,$2,$3,'COMMENT_ADDED',NULL,$4,$5),
          ($6,$2,$3,'COMMENT_ADDED',NULL,$7,$5)`,
        [
          secondHistoryId,
          initial.id,
          reporterUserId,
          { commentId: secondCommentId },
          tiedAt,
          firstHistoryId,
          { commentId: firstCommentId },
        ],
      );

      const comments = await repository.listComments(initial.id);
      assert.deepEqual(comments.map((comment) => comment.id), [
        firstCommentId,
        secondCommentId,
      ]);
      const history = await repository.listHistory(initial.id);
      assert.deepEqual(history.slice(-2).map((entry) => entry.id), [
        firstHistoryId,
        secondHistoryId,
      ]);
    });

    await t.test('backs off failed outbox deliveries and reports events that exhaust their attempts', async () => {
      const initial = await repository.createIssue(
        newIssue(randomUUID(), 'Outbox retry visibility'),
      );
      await database.query(
        'UPDATE outbox_events SET published_at = NOW() WHERE aggregate_id <> $1',
        [initial.id],
      );
      const [{ event_id: eventId }] = (
        await database.query<{ event_id: string }>(
          'SELECT event_id FROM outbox_events WHERE aggregate_id = $1',
          [initial.id],
        )
      ).rows;
      const outboxRow = async () =>
        (
          await database.query<{ last_error: string; delay_seconds: number }>(
            `SELECT last_error,
                    EXTRACT(EPOCH FROM next_attempt_at - NOW())::float8 AS delay_seconds
             FROM outbox_events WHERE event_id = $1`,
            [eventId],
          )
        ).rows[0];
      assert.deepEqual(
        (await repository.claimPendingEvents(50)).map((event) => event.eventId),
        [eventId],
      );

      assert.deepEqual(
        await repository.recordPublishFailure(eventId, 'broker unavailable'),
        { attempts: 1, abandoned: false },
      );
      assert.deepEqual(await repository.claimPendingEvents(50), []);
      const afterFirst = await outboxRow();
      assert.equal(afterFirst.last_error, 'broker unavailable');
      assert.ok(afterFirst.delay_seconds > 0 && afterFirst.delay_seconds <= 1.5);
      assert.equal((await repository.outboxStatus()).pending, 1);

      await database.query(
        'UPDATE outbox_events SET publish_attempts = 18, next_attempt_at = NOW() WHERE event_id = $1',
        [eventId],
      );
      assert.deepEqual(
        await repository.recordPublishFailure(eventId, 'broker unavailable'),
        { attempts: 19, abandoned: false },
      );
      const capped = await outboxRow();
      assert.ok(capped.delay_seconds > 290 && capped.delay_seconds <= 300);

      assert.deepEqual(
        await repository.recordPublishFailure(eventId, 'x'.repeat(2000)),
        { attempts: 20, abandoned: true },
      );
      await database.query(
        'UPDATE outbox_events SET next_attempt_at = NOW() WHERE event_id = $1',
        [eventId],
      );
      assert.deepEqual(await repository.claimPendingEvents(50), []);
      assert.equal((await outboxRow()).last_error.length, 1000);
      assert.deepEqual(await repository.outboxStatus(), {
        pending: 0,
        abandoned: 1,
        oldestPendingSeconds: null,
      });
    });

    await t.test('concurrent outbox claims lease disjoint event sets', async () => {
      await database.query('UPDATE outbox_events SET published_at = NOW() WHERE published_at IS NULL');
      const issues = await Promise.all(
        Array.from({ length: 10 }, (_, n) =>
          repository.createIssue(newIssue(randomUUID(), `Claim ${n}`)),
        ),
      );

      const [first, second] = await Promise.all([
        repository.claimPendingEvents(10),
        repository.claimPendingEvents(10),
      ]);
      const firstIds = first.map((event) => event.aggregateId);
      const secondIds = second.map((event) => event.aggregateId);
      assert.equal(firstIds.filter((id) => secondIds.includes(id)).length, 0);
      assert.deepEqual(
        [...firstIds, ...secondIds].sort(),
        issues.map((issue) => issue.id).sort(),
      );
      assert.deepEqual(await repository.claimPendingEvents(10), []);
    });

    await t.test('an unpublished earlier event blocks later events of the same issue only', async () => {
      await database.query('UPDATE outbox_events SET published_at = NOW() WHERE published_at IS NULL');
      const blocked = await repository.createIssue(newIssue(randomUUID(), 'Blocked'));
      await repository.updateIssue(
        blocked,
        blocked.version,
        { summary: 'Blocked v2', description: null, type: 'TASK', priority: 'MEDIUM' },
        reporterUserId,
      );
      const other = await repository.createIssue(newIssue(randomUUID(), 'Other'));
      const eventOf = async (aggregateId: string, version: number) =>
        (
          await database.query<{ event_id: string }>(
            'SELECT event_id FROM outbox_events WHERE aggregate_id = $1 AND aggregate_version = $2',
            [aggregateId, version],
          )
        ).rows[0].event_id;
      const v1 = await eventOf(blocked.id, 1);
      const v2 = await eventOf(blocked.id, 2);
      await repository.recordPublishFailure(v1, 'broker unavailable');

      const claimed = await repository.claimPendingEvents(50);
      assert.deepEqual(
        claimed.map((event) => [event.aggregateId, event.aggregateVersion]),
        [[other.id, 1]],
      );

      await database.query(
        'UPDATE outbox_events SET publish_attempts = 20, next_attempt_at = NOW() WHERE event_id = $1',
        [v1],
      );
      assert.deepEqual(await repository.claimPendingEvents(50), []);

      await repository.markEventsPublished([v1]);
      assert.deepEqual(
        (await repository.claimPendingEvents(50)).map((event) => event.eventId),
        [v2],
      );
    });

    await t.test('stores the trace context of the writing request with its outbox event', async () => {
      new node.NodeTracerProvider().register({ propagator: new W3CTraceContextPropagator() });
      await database.query('UPDATE outbox_events SET published_at = NOW() WHERE published_at IS NULL');
      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
      const traced = await context.with(
        propagation.extract(ROOT_CONTEXT, { traceparent }),
        () => repository.createIssue(newIssue(randomUUID(), 'Traced')),
      );
      const untraced = await repository.createIssue(newIssue(randomUUID(), 'Untraced'));

      const claimed = await repository.claimPendingEvents(50);
      const traceContextOf = (issueId: string) =>
        claimed.find((event) => event.aggregateId === issueId)?.traceContext;
      assert.equal(claimed.length, 2);
      assert.deepEqual(traceContextOf(traced.id), { traceparent });
      assert.equal(traceContextOf(untraced.id), null);
    });

    await t.test('creates the issue list indexes idempotently', async () => {
      await assert.doesNotReject(applyMigrations(admin, ['008_issue_list_indexes.sql']));
      const indexes = await database.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes
         WHERE tablename = 'issues' AND indexname LIKE 'ix_issues_%'
         ORDER BY indexname`,
      );
      for (const name of [
        'ix_issues_project_assignee_created',
        'ix_issues_project_created',
        'ix_issues_project_sprint_created',
        'ix_issues_project_status_created',
        'ix_issues_summary_trgm',
      ]) {
        assert.ok(indexes.rows.some((row) => row.indexname === name), name);
      }
    });

    await t.test('pages newest first and keeps the cursor stable when issues are created between pages', async () => {
      const projectId = randomUUID();
      for (let n = 1; n <= 5; n += 1) {
        await repository.createIssue(newIssue(projectId, `Paged issue ${n}`));
      }
      const existing = await orderedIssueIds(database, projectId);
      assert.equal(existing.length, 5);

      const first = await application.listIssues(projectId, { limit: '2' }, requestContext);
      assert.deepEqual(first.items.map((issue) => issue.id), existing.slice(0, 2));
      assert.ok(first.nextCursor);

      // A newer issue sorts before the first page; a backdated one lands in the unread range.
      const newer = await repository.createIssue(newIssue(projectId, 'Created between pages'));
      const backdated = await insertIssueRow(database, projectId, 100, {
        createdAt: '2000-01-01T00:00:00.000001Z',
      });

      const rest = await listAll(application, projectId, { limit: '2' }, first.nextCursor);
      const seen = [...first.items.map((issue) => issue.id), ...rest];
      assert.deepEqual(seen, [...existing, backdated]);
      assert.equal(new Set(seen).size, seen.length);
      assert.ok(!seen.includes(newer.id));

      const restarted = await listAll(application, projectId, { limit: '50' });
      assert.deepEqual(restarted, [newer.id, ...existing, backdated]);
    });

    await t.test('orders equal timestamps by id and never skips issues that differ below a millisecond', async () => {
      const projectId = randomUUID();
      const inserted: string[] = [];
      for (const [n, createdAt] of [
        '2030-01-01T00:00:00.123400Z',
        '2030-01-01T00:00:00.123456Z',
        '2030-01-01T00:00:00.123456Z',
        '2030-01-01T00:00:00.123456Z',
        '2030-01-01T00:00:00.123999Z',
        '2030-01-01T00:00:00.124000Z',
      ].entries()) {
        inserted.push(await insertIssueRow(database, projectId, n + 1, { createdAt }));
      }

      const expected = await orderedIssueIds(database, projectId);
      assert.equal(expected.length, inserted.length);
      assert.deepEqual(await listAll(application, projectId, { limit: '1' }), expected);
      const tied = expected.slice(2, 5);
      assert.deepEqual(tied, [...tied].sort().reverse());
    });

    await t.test('filters by status, assignee, sprint, and literal case-insensitive summary text', async () => {
      const projectId = randomUUID();
      const otherProjectId = randomUUID();
      const assignee = '22222222-2222-4222-8222-222222222222';
      const sprintId = randomUUID();
      await database.query(
        `INSERT INTO sprints (id, project_id, name, status, created_at)
         VALUES ($1, $2, 'Sprint', 'ACTIVE', NOW())`,
        [sprintId, projectId],
      );
      const row = (number: number, values: Parameters<typeof insertIssueRow>[3]) =>
        insertIssueRow(database, projectId, number, values);
      const loginBug = await row(1, { summary: 'Fix LOGIN bug', status: 'DONE', assigneeUserId: assignee, sprintId });
      const loginCopy = await row(2, { summary: 'login page copy', status: 'DONE' });
      const percent = await row(3, { summary: 'Reach 100% coverage', assigneeUserId: assignee });
      const underscore = await row(4, { summary: 'Rename snake_case field', sprintId });
      const backslash = await row(5, { summary: 'Escape C:\\temp paths', status: 'IN_PROGRESS' });
      const plain = await row(6, { summary: 'Plain issue 1000 coverage' });
      await insertIssueRow(database, otherProjectId, 1, { summary: 'Fix LOGIN bug elsewhere', status: 'DONE' });

      const filtered = async (query: Record<string, string>) =>
        (await listAll(application, projectId, query)).sort();
      const ids = (...issues: string[]) => issues.sort();

      assert.deepEqual(await filtered({}), ids(loginBug, loginCopy, percent, underscore, backslash, plain));
      assert.deepEqual(await filtered({ status: 'done' }), ids(loginBug, loginCopy));
      assert.deepEqual(await filtered({ status: 'TODO' }), ids(percent, underscore, plain));
      assert.deepEqual(await filtered({ assigneeUserId: assignee }), ids(loginBug, percent));
      assert.deepEqual(await filtered({ sprintId }), ids(loginBug, underscore));
      assert.deepEqual(await filtered({ q: 'Login' }), ids(loginBug, loginCopy));
      assert.deepEqual(await filtered({ q: '100%' }), ids(percent));
      assert.deepEqual(await filtered({ q: '%' }), ids(percent));
      assert.deepEqual(await filtered({ q: '_' }), ids(underscore));
      assert.deepEqual(await filtered({ q: '\\' }), ids(backslash));
      assert.deepEqual(await filtered({ q: 'no such text' }), []);
      assert.deepEqual(
        await filtered({ status: 'DONE', assigneeUserId: assignee, sprintId, q: 'login' }),
        ids(loginBug),
      );
      assert.deepEqual(await filtered({ status: 'DONE', q: 'copy', sprintId }), []);

      const limited = await application.listIssues(projectId, { limit: '4' }, requestContext);
      assert.equal(limited.items.length, 4);
      assert.ok(limited.nextCursor);
      const lastPage = await application.listIssues(
        projectId,
        { limit: '4', cursor: limited.nextCursor },
        requestContext,
      );
      assert.equal(lastPage.items.length, 2);
      assert.equal(lastPage.nextCursor, null);
      const exact = await application.listIssues(projectId, { limit: '6' }, requestContext);
      assert.equal(exact.items.length, 6);
      assert.equal(exact.nextCursor, null);
      assert.equal((await application.listIssues(projectId, {}, requestContext)).nextCursor, null);
    });

    await t.test('HTTP bodies and published Kafka envelopes match the shared contracts', async () => {
      await database.query('UPDATE outbox_events SET published_at = NOW() WHERE published_at IS NULL');
      const planningRepository = new PostgresPlanningRepository(database);
      const access = activeProjectAccess();
      const issues = new IssueApplicationService(repository, planningRepository, access);
      const planning = new PlanningApplicationService(planningRepository, access);
      // Controllers return these results unchanged; Fastify writes them with JSON.stringify.
      const expectBody = <T>(definition: string, result: T): T => {
        assertContract(`http/issue.schema.json#/$defs/${definition}`, JSON.parse(JSON.stringify(result)));
        return result;
      };
      const projectId = randomUUID();
      const assigneeUserId = '22222222-2222-4222-8222-222222222222';

      const { epic } = expectBody('epicResponse', await planning.createEpic(projectId, { name: 'Launch', startDate: '2026-10-01', targetDate: '2026-10-31' }, requestContext));
      expectBody('epicResponse', await planning.updateEpic(epic.id, { color: 'green' }, requestContext));
      expectBody('epicList', await planning.listEpics(projectId, requestContext));
      const { sprint } = expectBody('sprintResponse', await planning.createSprint(projectId, { name: 'Sprint 1', goal: 'Ship it' }, requestContext));
      expectBody('sprintList', await planning.listSprints(projectId, requestContext));

      let { issue } = expectBody('issueResponse', await issues.createIssue(projectId, {
        summary: 'Contract issue', description: 'Checked against issue.schema.json', type: 'story', priority: 'high',
        assigneeUserId, epicId: epic.id, sprintId: sprint.id,
      }, requestContext));
      expectBody('issueList', await issues.listIssues(projectId, {}, requestContext));
      expectBody('issueList', await issues.listIssues(projectId, { limit: '1', q: 'contract' }, requestContext));
      expectBody('issueResponse', await issues.getIssue(issue.id, requestContext));
      ({ issue } = expectBody('issueResponse', await issues.updateIssue(issue.id, { summary: 'Renamed', expectedVersion: issue.version }, requestContext)));
      ({ issue } = expectBody('issueResponse', await issues.assignIssue(issue.id, { assigneeUserId: null, expectedVersion: issue.version }, requestContext)));
      ({ issue } = expectBody('issueResponse', await issues.assignIssue(issue.id, { assigneeUserId, expectedVersion: issue.version }, requestContext)));
      ({ issue } = expectBody('issueResponse', await issues.transitionIssue(issue.id, { status: 'IN_PROGRESS', expectedVersion: issue.version }, requestContext)));
      expectBody('commentResponse', await issues.addComment(issue.id, { body: 'Contract comment' }, requestContext));
      expectBody('commentList', await issues.listComments(issue.id, requestContext));
      expectBody('historyList', await issues.listHistory(issue.id, requestContext));
      expectBody('sprintResponse', await planning.completeSprint(sprint.id, requestContext));

      const sent: Array<{ key: string; value: string }> = [];
      const publisher = new OutboxPublisher(repository);
      Object.defineProperty(publisher, 'producer', { value: {
        connect: async () => {},
        send: async (batch: { messages: Array<{ key: string; value: string }> }) => { sent.push(...batch.messages); },
      } });
      Object.defineProperty(publisher, 'logger', { value: { log: () => {}, warn: () => {}, error: () => {} } });
      // One event per Issue per poll (ADR 0004); poll until the outbox is drained.
      for (let polls = 0, before = -1; before !== sent.length && polls < 20; polls += 1) {
        before = sent.length;
        await (publisher as unknown as { publishBatch(): Promise<void> }).publishBatch();
      }

      const envelopes = sent.map((message) => {
        const envelope = JSON.parse(message.value) as { aggregateId: string; eventType: string };
        assertContract('events/issue-event-v1.schema.json', envelope);
        assert.equal(message.key, envelope.aggregateId);
        return envelope;
      });
      assert.deepEqual(envelopes.map((envelope) => envelope.eventType), [
        'issue.created', 'issue.updated', 'issue.assigned', 'issue.assigned', 'issue.transitioned', 'issue.commented',
      ]);
    });
  },
);

function issueApplication(
  repository: PostgresIssueRepository,
  access: ProjectAccessPort = activeProjectAccess(),
): IssueApplicationService {
  return new IssueApplicationService(repository, unusedPlanningRepository(), access);
}

function activeProjectAccess(
  beforeReturn?: () => Promise<void>,
): ProjectAccessPort {
  return {
    async getAccess(projectId) {
      await beforeReturn?.();
      return {
        projectId,
        workspaceId: '33333333-3333-4333-8333-333333333333',
        projectKey: 'CORE',
        projectStatus: 'ACTIVE',
        membershipRole: 'MEMBER',
      };
    },
  };
}

function createTwoRequestBarrier(): () => Promise<void> {
  let arrivals = 0;
  let release: () => void;
  const bothArrived = new Promise<void>((resolve) => {
    release = resolve;
  });

  return async () => {
    arrivals += 1;
    if (arrivals === 2) {
      release!();
    }
    await bothArrived;
  };
}

function unusedPlanningRepository(): PlanningRepository {
  return {
    async createEpic() {
      throw new Error('not used by lifecycle integration tests');
    },
    async listEpics() {
      return [];
    },
    async findEpic() {
      return null;
    },
    async updateEpic() {
      throw new Error('not used by lifecycle integration tests');
    },
    async createSprint() {
      throw new Error('not used by lifecycle integration tests');
    },
    async listSprints() {
      return [];
    },
    async findSprint() {
      return null;
    },
    async completeSprint() {
      throw new Error('not used by lifecycle integration tests');
    },
  };
}

function assertConcurrentIssueFailure(
  outcomes: readonly PromiseSettledResult<unknown>[],
): void {
  const failure = outcomes.find(
    (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
  );
  assert.ok(failure);
  assert.ok(failure.reason instanceof DomainError);
  assert.equal(failure.reason.status, 409);
  assert.equal(failure.reason.code, 'CONCURRENT_ISSUE_MODIFICATION');
}

interface CommentFailure {
  name: string;
  relation: 'issues' | 'issue_comments' | 'issue_history' | 'outbox_events';
  message: string;
  trigger: string;
}

async function assertRollbackForCommentFailure(
  database: Database,
  admin: Pool,
  repository: PostgresIssueRepository,
  application: IssueApplicationService,
  failure: CommentFailure,
): Promise<void> {
  const initial = await repository.createIssue(
    newIssue(randomUUID(), `Comment rollback ${failure.name}`),
  );
  const functionName = `fail_comment_${failure.name}`;
  const triggerName = `${functionName}_trigger`;
  await admin.query(`
    CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION '${failure.message}';
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER ${triggerName}
      ${failure.trigger} EXECUTE FUNCTION ${functionName}();
  `);

  try {
    await assert.rejects(
      application.addComment(
        initial.id,
        { body: `Comment rollback ${failure.name}` },
        requestContext,
      ),
      new RegExp(failure.message),
    );
  } finally {
    await admin.query(
      `DROP TRIGGER IF EXISTS ${triggerName} ON ${failure.relation};
       DROP FUNCTION IF EXISTS ${functionName}();`,
    );
  }

  await assertCommentState(
    database,
    initial.id,
    initial.version,
    { commentCount: '0', historyCount: '0', outboxCount: '0' },
  );
}

async function assertCommentState(
  database: Database,
  issueId: string,
  expectedVersion: number,
  expectedEffects: {
    commentCount: string;
    historyCount: string;
    outboxCount: string;
  },
): Promise<void> {
  const persisted = await database.query<{ version: number }>(
    'SELECT version FROM issues WHERE id = $1',
    [issueId],
  );
  assert.equal(persisted.rows[0].version, expectedVersion);

  const effects = await database.query<{
    comment_count: string;
    history_count: string;
    outbox_count: string;
  }>(
    `SELECT
      (SELECT count(*) FROM issue_comments WHERE issue_id = $1) AS comment_count,
      (SELECT count(*) FROM issue_history WHERE issue_id = $1 AND action = 'COMMENT_ADDED') AS history_count,
      (SELECT count(*) FROM outbox_events WHERE aggregate_id = $1 AND event_type = 'issue.commented') AS outbox_count`,
    [issueId],
  );
  assert.deepEqual(effects.rows[0], {
    comment_count: expectedEffects.commentCount,
    history_count: expectedEffects.historyCount,
    outbox_count: expectedEffects.outboxCount,
  });
}

async function assertRollbackForStatusUpdateFailure(
  database: Database,
  admin: Pool,
  repository: PostgresIssueRepository,
  application: IssueApplicationService,
): Promise<void> {
  const initial = await repository.createIssue(
    newIssue(randomUUID(), 'Status update rollback'),
  );
  await admin.query(`
    CREATE FUNCTION fail_transition_status_update() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'forced transition status update failure';
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_transition_status_update
      BEFORE UPDATE OF status ON issues
      FOR EACH ROW EXECUTE FUNCTION fail_transition_status_update();
  `);

  try {
    await assert.rejects(
      application.transitionIssue(
        initial.id,
        { status: 'IN_PROGRESS', expectedVersion: initial.version },
        requestContext,
      ),
      /forced transition status update failure/,
    );
  } finally {
    await admin.query(
      'DROP TRIGGER IF EXISTS fail_transition_status_update ON issues; DROP FUNCTION IF EXISTS fail_transition_status_update();',
    );
  }

  await assertTransitionState(
    database,
    initial.id,
    'TODO',
    initial.version,
    { historyCount: '0', outboxCount: '0' },
  );
}

async function assertRollbackForHistoryInsertFailure(
  database: Database,
  admin: Pool,
  repository: PostgresIssueRepository,
  application: IssueApplicationService,
): Promise<void> {
  const initial = await repository.createIssue(
    newIssue(randomUUID(), 'History rollback'),
  );
  await admin.query(`
    CREATE FUNCTION fail_transition_history_insert() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'forced transition history failure';
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_transition_history_insert
      BEFORE INSERT ON issue_history
      FOR EACH ROW WHEN (NEW.action = 'STATUS_CHANGED')
      EXECUTE FUNCTION fail_transition_history_insert();
  `);

  try {
    await assert.rejects(
      application.transitionIssue(
        initial.id,
        { status: 'IN_PROGRESS', expectedVersion: initial.version },
        requestContext,
      ),
      /forced transition history failure/,
    );
  } finally {
    await admin.query(
      'DROP TRIGGER IF EXISTS fail_transition_history_insert ON issue_history; DROP FUNCTION IF EXISTS fail_transition_history_insert();',
    );
  }

  await assertTransitionState(
    database,
    initial.id,
    'TODO',
    initial.version,
    { historyCount: '0', outboxCount: '0' },
  );
}

async function assertRollbackForOutboxInsertFailure(
  database: Database,
  admin: Pool,
  repository: PostgresIssueRepository,
  application: IssueApplicationService,
): Promise<void> {
  const initial = await repository.createIssue(
    newIssue(randomUUID(), 'Outbox rollback'),
  );
  await admin.query(`
    CREATE FUNCTION fail_transition_outbox_insert() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'forced transition outbox failure';
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_transition_outbox_insert
      BEFORE INSERT ON outbox_events
      FOR EACH ROW WHEN (NEW.event_type = 'issue.transitioned')
      EXECUTE FUNCTION fail_transition_outbox_insert();
  `);

  try {
    await assert.rejects(
      application.transitionIssue(
        initial.id,
        { status: 'IN_PROGRESS', expectedVersion: initial.version },
        requestContext,
      ),
      /forced transition outbox failure/,
    );
  } finally {
    await admin.query(
      'DROP TRIGGER IF EXISTS fail_transition_outbox_insert ON outbox_events; DROP FUNCTION IF EXISTS fail_transition_outbox_insert();',
    );
  }

  await assertTransitionState(
    database,
    initial.id,
    'TODO',
    initial.version,
    { historyCount: '0', outboxCount: '0' },
  );
}

async function assertTransitionState(
  database: Database,
  issueId: string,
  expectedStatus: string,
  expectedVersion: number,
  expectedEffects: { historyCount: string; outboxCount: string },
): Promise<void> {
  const persisted = await database.query<{ status: string; version: number }>(
    'SELECT status, version FROM issues WHERE id = $1',
    [issueId],
  );
  assert.deepEqual(persisted.rows[0], {
    status: expectedStatus,
    version: expectedVersion,
  });

  const effects = await database.query<{
    history_count: string;
    outbox_count: string;
  }>(
    `SELECT
      (SELECT count(*) FROM issue_history WHERE issue_id = $1 AND action = 'STATUS_CHANGED') AS history_count,
      (SELECT count(*) FROM outbox_events WHERE aggregate_id = $1 AND event_type = 'issue.transitioned') AS outbox_count`,
    [issueId],
  );
  assert.deepEqual(effects.rows[0], {
    history_count: expectedEffects.historyCount,
    outbox_count: expectedEffects.outboxCount,
  });
}

async function listAll(
  application: IssueApplicationService,
  projectId: string,
  query: Record<string, string>,
  cursor?: string | null,
): Promise<string[]> {
  const ids: string[] = [];
  let next = cursor;
  do {
    const page = await application.listIssues(
      projectId,
      next ? { ...query, cursor: next } : query,
      requestContext,
    );
    ids.push(...page.items.map((issue) => issue.id));
    next = page.nextCursor;
  } while (next);
  return ids;
}

async function orderedIssueIds(database: Database, projectId: string): Promise<string[]> {
  const result = await database.query<{ id: string }>(
    'SELECT id FROM issues WHERE project_id = $1 ORDER BY created_at DESC, id DESC',
    [projectId],
  );
  return result.rows.map((row) => row.id);
}

async function insertIssueRow(
  database: Database,
  projectId: string,
  number: number,
  values: {
    createdAt?: string;
    summary?: string;
    status?: string;
    assigneeUserId?: string;
    sprintId?: string;
  },
): Promise<string> {
  const id = randomUUID();
  await database.query(
    `INSERT INTO issues (
       id, project_id, issue_number, issue_key, summary, type, priority, status,
       reporter_user_id, assignee_user_id, sprint_id, version, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,'TASK','LOW',$6,$7,$8,$9,1,$10::timestamptz,$10::timestamptz)`,
    [
      id,
      projectId,
      number,
      `LIST-${number}`,
      values.summary ?? `Listed issue ${number}`,
      values.status ?? 'TODO',
      reporterUserId,
      values.assigneeUserId ?? null,
      values.sprintId ?? null,
      values.createdAt ?? new Date().toISOString(),
    ],
  );
  return id;
}

function newIssue(projectId: string, summary: string): NewIssueData {
  return {
    projectId,
    projectKey: 'CORE',
    summary,
    description: null,
    type: 'TASK',
    priority: 'MEDIUM',
    reporterUserId,
    assigneeUserId: null,
    epicId: null,
    sprintId: null,
  };
}

function assertDisposableTestDatabaseUrl(databaseUrl: string): void {
  let databaseName: string;
  try {
    databaseName = decodeURIComponent(new URL(databaseUrl).pathname).replace(/^\/+/, '');
  } catch {
    throw new Error('ISSUE_SERVICE_TEST_DATABASE_URL must be a valid PostgreSQL URL');
  }

  if (databaseName.toLowerCase() !== 'issue_test_db') {
    throw new Error(
      'ISSUE_SERVICE_TEST_DATABASE_URL must target the dedicated disposable issue_test_db database and must never target issue_db',
    );
  }
}

async function applyMigrations(pool: Pool, names: string[]): Promise<void> {
  for (const name of names) {
    const migration = await readFile(join(process.cwd(), 'migrations', name), 'utf8');
    await pool.query(migration);
  }
}

async function resetSchema(pool: Pool): Promise<void> {
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
}

function isPostgresCheckViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23514'
  );
}
