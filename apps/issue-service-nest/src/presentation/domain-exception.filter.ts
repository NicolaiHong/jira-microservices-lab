import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { DomainError } from '../domain/errors';

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    const request = host.switchToHttp().getRequest<FastifyRequest>();
    const correlationId =
      typeof request.headers['x-correlation-id'] === 'string'
        ? request.headers['x-correlation-id']
        : request.id;

    const [status, body] =
      error instanceof DomainError
        ? [error.status, { code: error.code, message: error.message, details: error.details }]
        : error instanceof HttpException
          ? [error.getStatus(), { code: 'HTTP_ERROR', message: error.message, details: {} }]
          : [500, { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} }];
    if (status >= 500) {
      // Exception messages can contain SQL values or credentials. Log diagnostic
      // stack frames and stable error codes, never request bodies or raw messages.
      this.logger.error(JSON.stringify({
        service: 'issue-service', correlationId, status,
        code: error instanceof DomainError ? error.code : 'INTERNAL_ERROR',
        message: 'request_failed',
        stack: error instanceof Error ? error.stack?.split('\n').filter((line) => /^\s+at /.test(line)).join('\n') : undefined,
      }));
    }

    void response.status(status).send({ ...body, correlationId });
  }
}
