import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { Pool } from 'pg';
import { IssueApplicationService } from '../application/issue-application.service';
import type {
  NewIssueData,
  PlanningRepository,
  ProjectAccessPort,
} from '../application/ports';
import { DomainError } from '../domain/errors';
import type { Issue } from '../domain/issue';
import { Database } from './database';
import { PostgresIssueRepository } from './postgres-issue.repository';

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
