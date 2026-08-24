import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { Pool } from 'pg';
import type { NewIssueData } from '../application/ports';
import { DomainError } from '../domain/errors';
import { Database } from './database';
import { PostgresIssueRepository } from './postgres-issue.repository';

const testDatabaseUrl = process.env.ISSUE_SERVICE_TEST_DATABASE_URL;
const reporterUserId = '11111111-1111-4111-8111-111111111111';
const assigneeUserId = '22222222-2222-4222-8222-222222222222';

test(
  'PostgreSQL Issue Core hardening migration, concurrency, and atomicity',
  { skip: testDatabaseUrl ? false : 'ISSUE_SERVICE_TEST_DATABASE_URL is not set' },
  async (t) => {
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

    await t.test('stops the migration when legacy descriptions violate the new database constraint', async () => {
      await resetSchema(admin);
      await applyMigrations(admin, ['001_init.sql', '002_scope_issue_key_to_project.sql', '003_planning.sql']);
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

    await resetSchema(admin);
    await database.onModuleInit();
    const repository = new PostgresIssueRepository(database);

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

    await t.test('allocates unique project numbers and keys under concurrent creation', async () => {
      const projectId = randomUUID();
      const created = await Promise.all(
        Array.from({ length: 40 }, (_, index) =>
          repository.createIssue(newIssue(projectId, `Concurrent issue ${index}`)),
        ),
      );
      const numbers = created.map((item) => item.number).sort((left, right) => left - right);
      const keys = new Set(created.map((item) => item.key));
      assert.deepEqual(numbers, Array.from({ length: 40 }, (_, index) => index + 1));
      assert.equal(keys.size, 40);
      const sequence = await database.query<{ last_number: number }>(
        'SELECT last_number FROM project_issue_sequences WHERE project_id = $1',
        [projectId],
      );
      assert.equal(sequence.rows[0].last_number, 40);
    });

    await t.test('uses PostgreSQL compare-and-swap to yield one success and one deterministic stale conflict', async () => {
      const initial = await repository.createIssue(newIssue(randomUUID(), 'Concurrent mutation'));
      const outcomes = await Promise.allSettled([
        repository.updateIssue(
          initial,
          initial.version,
          { summary: 'Updated once', description: null, type: 'TASK', priority: 'HIGH' },
          reporterUserId,
        ),
        repository.assignIssue(initial, initial.version, assigneeUserId, reporterUserId),
      ]);
      assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
      const failure = outcomes.find((outcome) => outcome.status === 'rejected');
      assert.ok(failure && failure.status === 'rejected');
      assert.ok(failure.reason instanceof DomainError);
      assert.equal(failure.reason.status, 409);
      assert.equal(failure.reason.code, 'CONCURRENT_ISSUE_MODIFICATION');

      const persisted = await repository.findIssue(initial.id);
      assert.ok(persisted);
      assert.equal(persisted.version, 2);
      const sideEffects = await database.query<{ history_count: string; outbox_count: string }>(
        `SELECT
           (SELECT count(*) FROM issue_history WHERE issue_id = $1) AS history_count,
           (SELECT count(*) FROM outbox_events WHERE aggregate_id = $1) AS outbox_count`,
        [initial.id],
      );
      assert.deepEqual(sideEffects.rows[0], { history_count: '2', outbox_count: '2' });
    });

    await t.test('rolls back Issue, history, and outbox when a later history or outbox write fails', async () => {
      const historyFailureIssue = await repository.createIssue(newIssue(randomUUID(), 'History rollback'));
      await database.query(`
        CREATE FUNCTION fail_issue_history_insert() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'forced history failure';
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER fail_issue_history_insert
          BEFORE INSERT ON issue_history
          FOR EACH ROW EXECUTE FUNCTION fail_issue_history_insert();
      `);
      await assert.rejects(
        repository.updateIssue(
          historyFailureIssue,
          historyFailureIssue.version,
          { summary: 'Should roll back', description: null, type: 'TASK', priority: 'LOW' },
          reporterUserId,
        ),
        /forced history failure/,
      );
      await database.query('DROP TRIGGER fail_issue_history_insert ON issue_history; DROP FUNCTION fail_issue_history_insert();');
      await assertUnchangedAfterFailedWrite(database, historyFailureIssue.id, historyFailureIssue.version);

      const outboxFailureIssue = await repository.createIssue(newIssue(randomUUID(), 'Outbox rollback'));
      await database.query(`
        CREATE FUNCTION fail_outbox_insert() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'forced outbox failure';
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER fail_outbox_insert
          BEFORE INSERT ON outbox_events
          FOR EACH ROW EXECUTE FUNCTION fail_outbox_insert();
      `);
      await assert.rejects(
        repository.updateIssue(
          outboxFailureIssue,
          outboxFailureIssue.version,
          { summary: 'Should roll back', description: null, type: 'TASK', priority: 'LOW' },
          reporterUserId,
        ),
        /forced outbox failure/,
      );
      await database.query('DROP TRIGGER fail_outbox_insert ON outbox_events; DROP FUNCTION fail_outbox_insert();');
      await assertUnchangedAfterFailedWrite(database, outboxFailureIssue.id, outboxFailureIssue.version);
    });
  },
);

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

async function applyMigrations(pool: Pool, names: string[]): Promise<void> {
  for (const name of names) {
    const migration = await readFile(join(process.cwd(), 'migrations', name), 'utf8');
    await pool.query(migration);
  }
}

async function resetSchema(pool: Pool): Promise<void> {
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
}

async function assertUnchangedAfterFailedWrite(
  database: Database,
  issueId: string,
  expectedVersion: number,
): Promise<void> {
  const persisted = await database.query<{ version: number }>(
    'SELECT version FROM issues WHERE id = $1',
    [issueId],
  );
  assert.equal(persisted.rows[0].version, expectedVersion);
  const sideEffects = await database.query<{ history_count: string; outbox_count: string }>(
    `SELECT
       (SELECT count(*) FROM issue_history WHERE issue_id = $1) AS history_count,
       (SELECT count(*) FROM outbox_events WHERE aggregate_id = $1) AS outbox_count`,
    [issueId],
  );
  assert.deepEqual(sideEffects.rows[0], { history_count: '1', outbox_count: '1' });
}

function isPostgresCheckViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23514'
  );
}
