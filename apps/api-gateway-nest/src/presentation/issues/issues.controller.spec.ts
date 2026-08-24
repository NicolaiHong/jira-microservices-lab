import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import type { InjectOptions, Response as InjectResponse } from 'light-my-request';
import { AppException } from '../../common/errors/app.exception';
import { IssuesService } from '../../services/issues.service';
import { ApiExceptionFilter } from '../common/filters/api-exception.filter';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { IssuesController } from './issues.controller';

const jwtConfiguration = {
  secret: 'gateway-transition-test-secret-32-bytes',
  issuer: 'gateway-transition-test-issuer',
  audience: 'gateway-transition-test-audience',
};

interface TransitionCall {
  issueId: string;
  body: unknown;
  userId: string | undefined;
  correlationId: string;
}

interface CommentActivityCall {
  operation: 'addComment' | 'listComments' | 'listHistory';
  issueId: string;
  body: unknown;
  userId: string | undefined;
  correlationId: string;
}

class RecordingIssuesService {
  readonly calls: TransitionCall[] = [];
  readonly commentActivityCalls: CommentActivityCall[] = [];
  nextError: AppException | undefined;

  transitionIssue(
    issueId: string,
    body: unknown,
    userId: string | undefined,
    correlationId: string,
  ) {
    this.calls.push({ issueId, body, userId, correlationId });
    if (this.nextError) {
      throw this.nextError;
    }

    return {
      issue: {
        id: issueId,
        status: 'IN_PROGRESS',
        version: 2,
      },
    };
  }

  addComment(
    issueId: string,
    body: unknown,
    userId: string | undefined,
    correlationId: string,
  ) {
    this.commentActivityCalls.push({
      operation: 'addComment',
      issueId,
      body,
      userId,
      correlationId,
    });
    if (this.nextError) {
      throw this.nextError;
    }

    return { comment: { id: 'comment-123', issueId, body: (body as { body?: unknown }).body } };
  }

  listComments(issueId: string, userId: string | undefined, correlationId: string) {
    this.commentActivityCalls.push({
      operation: 'listComments',
      issueId,
      body: undefined,
      userId,
      correlationId,
    });
    if (this.nextError) {
      throw this.nextError;
    }

    return { items: [{ id: 'comment-123', issueId }] };
  }

  listHistory(issueId: string, userId: string | undefined, correlationId: string) {
    this.commentActivityCalls.push({
      operation: 'listHistory',
      issueId,
      body: undefined,
      userId,
      correlationId,
    });
    if (this.nextError) {
      throw this.nextError;
    }

    return { items: [{ id: 'history-123', issueId, action: 'COMMENT_ADDED' }] };
  }
}

test('routes transition requests through JWT authentication and the public error envelope', async (t) => {
  const restore = configureJwtEnvironment();
  const issues = new RecordingIssuesService();
  const app = await createGatewayApp(issues);
  const accessToken = signedAccessToken(60);

  try {
    await t.test('uses POST /api/issues/:issueId/transitions and forwards the authenticated request context', async () => {
      const response = await inject(app, {
        method: 'POST',
        url: '/api/issues/issue-123/transitions',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          'x-correlation-id': 'client-correlation-123',
        },
        payload: { status: 'IN_PROGRESS', expectedVersion: 1 },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(JSON.parse(response.body), {
        issue: { id: 'issue-123', status: 'IN_PROGRESS', version: 2 },
      });
      assert.deepEqual(issues.calls, [
        {
          issueId: 'issue-123',
          body: { status: 'IN_PROGRESS', expectedVersion: 1 },
          userId: 'member-123',
          correlationId: 'client-correlation-123',
        },
      ]);
    });

    await t.test('preserves documented transition conflict codes in the public response', async () => {
      for (const code of [
        'INVALID_ISSUE_TRANSITION',
        'CONCURRENT_ISSUE_MODIFICATION',
        'PROJECT_ARCHIVED',
      ]) {
        issues.nextError = new AppException(
          409,
          code,
          `${code} from Issue Service`,
          { source: 'issue-service' },
        );
        const callsBeforeRequest = issues.calls.length;
        const response = await inject(app, {
          method: 'POST',
          url: '/api/issues/issue-123/transitions',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
            'x-correlation-id': `client-correlation-${code}`,
          },
          payload: { status: 'IN_PROGRESS', expectedVersion: 1 },
        });

        assert.equal(response.statusCode, 409);
        assert.deepEqual(JSON.parse(response.body), {
          code,
          message: `${code} from Issue Service`,
          correlationId: `client-correlation-${code}`,
          details: { source: 'issue-service' },
        });
        assert.equal(issues.calls.length, callsBeforeRequest + 1);
      }
      issues.nextError = undefined;
    });

    await t.test('rejects invalid and expired JWTs before the Issue Service can be called', async () => {
      for (const [token, expectedCode] of [
        ['not-a-jwt', 'INVALID_TOKEN'],
        [signedAccessToken(-1), 'TOKEN_EXPIRED'],
      ]) {
        const callsBeforeRequest = issues.calls.length;
        const response = await inject(app, {
          method: 'POST',
          url: '/api/issues/issue-123/transitions',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          payload: { status: 'IN_PROGRESS', expectedVersion: 1 },
        });

        assert.equal(response.statusCode, 401);
        assert.equal(
          (JSON.parse(response.body) as { code: string }).code,
          expectedCode,
        );
        assert.equal(issues.calls.length, callsBeforeRequest);
      }
    });
  } finally {
    await app.close();
    restore();
  }
});

test('routes comment and activity requests through JWT authentication without Gateway business logic', async (t) => {
  const restore = configureJwtEnvironment();
  const issues = new RecordingIssuesService();
  const app = await createGatewayApp(issues);
  const accessToken = signedAccessToken(60);

  try {
    await t.test('forwards POST comments with its opaque body, identity, and correlation ID', async () => {
      const response = await inject(app, {
        method: 'POST',
        url: '/api/issues/issue-123/comments',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          'x-correlation-id': 'comment-correlation-123',
        },
        payload: { body: 'Opaque comment body' },
      });

      assert.equal(response.statusCode, 201);
      assert.deepEqual(JSON.parse(response.body), {
        comment: {
          id: 'comment-123',
          issueId: 'issue-123',
          body: 'Opaque comment body',
        },
      });
      assert.deepEqual(issues.commentActivityCalls, [
        {
          operation: 'addComment',
          issueId: 'issue-123',
          body: { body: 'Opaque comment body' },
          userId: 'member-123',
          correlationId: 'comment-correlation-123',
        },
      ]);
    });

    await t.test('forwards GET comments and history with identity and correlation ID', async () => {
      const commentsResponse = await inject(app, {
        method: 'GET',
        url: '/api/issues/issue-123/comments',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'x-correlation-id': 'comments-read-correlation-123',
        },
      });
      const historyResponse = await inject(app, {
        method: 'GET',
        url: '/api/issues/issue-123/history',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'x-correlation-id': 'history-read-correlation-123',
        },
      });

      assert.equal(commentsResponse.statusCode, 200);
      assert.equal(historyResponse.statusCode, 200);
      assert.deepEqual(issues.commentActivityCalls.slice(1), [
        {
          operation: 'listComments',
          issueId: 'issue-123',
          body: undefined,
          userId: 'member-123',
          correlationId: 'comments-read-correlation-123',
        },
        {
          operation: 'listHistory',
          issueId: 'issue-123',
          body: undefined,
          userId: 'member-123',
          correlationId: 'history-read-correlation-123',
        },
      ]);
    });

    await t.test('preserves existing downstream comment errors in the public envelope', async () => {
      issues.nextError = new AppException(
        409,
        'CONCURRENT_ISSUE_MODIFICATION',
        'Issue changed since it was last loaded',
        { source: 'issue-service' },
      );
      const response = await inject(app, {
        method: 'POST',
        url: '/api/issues/issue-123/comments',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          'x-correlation-id': 'comment-conflict-correlation-123',
        },
        payload: { body: 'Will conflict' },
      });

      assert.equal(response.statusCode, 409);
      assert.deepEqual(JSON.parse(response.body), {
        code: 'CONCURRENT_ISSUE_MODIFICATION',
        message: 'Issue changed since it was last loaded',
        correlationId: 'comment-conflict-correlation-123',
        details: { source: 'issue-service' },
      });
      issues.nextError = undefined;
    });
  } finally {
    await app.close();
    restore();
  }
});

async function createGatewayApp(
  issues: RecordingIssuesService,
): Promise<NestFastifyApplication> {
  @Module({
    controllers: [IssuesController],
    providers: [
      JwtAuthGuard,
      { provide: IssuesService, useValue: issues },
    ],
  })
  class GatewayTransitionTestModule {}

  const app = await NestFactory.create<NestFastifyApplication>(
    GatewayTransitionTestModule,
    new FastifyAdapter(),
    { logger: false },
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();
  return app;
}

function inject(
  app: NestFastifyApplication,
  options: InjectOptions,
): Promise<InjectResponse> {
  const fastify = app.getHttpAdapter().getInstance() as FastifyInstance;
  return fastify.inject(options);
}

function signedAccessToken(expiresIn: number): string {
  return jwt.sign(
    {
      sub: 'member-123',
      email: 'member@example.test',
      roles: ['MEMBER'],
    },
    jwtConfiguration.secret,
    {
      algorithm: 'HS256',
      issuer: jwtConfiguration.issuer,
      audience: jwtConfiguration.audience,
      expiresIn,
    },
  );
}

function configureJwtEnvironment(): () => void {
  const original = {
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_ISSUER: process.env.JWT_ISSUER,
    JWT_AUDIENCE: process.env.JWT_AUDIENCE,
  };
  process.env.JWT_SECRET = jwtConfiguration.secret;
  process.env.JWT_ISSUER = jwtConfiguration.issuer;
  process.env.JWT_AUDIENCE = jwtConfiguration.audience;

  return () => {
    restoreEnvironmentVariable('JWT_SECRET', original.JWT_SECRET);
    restoreEnvironmentVariable('JWT_ISSUER', original.JWT_ISSUER);
    restoreEnvironmentVariable('JWT_AUDIENCE', original.JWT_AUDIENCE);
  };
}

function restoreEnvironmentVariable(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
