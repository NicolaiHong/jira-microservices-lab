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

class RecordingIssuesService {
  readonly calls: TransitionCall[] = [];
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
