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

    const status = error instanceof DomainError ? error.status : error instanceof HttpException ? error.getStatus() : 500;
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

    if (error instanceof DomainError) {
      void response.status(error.status).send({
        code: error.code,
        message: error.message,
        details: error.details,
        correlationId,
      });
      return;
    }

    if (error instanceof HttpException) {
      void response.status(error.getStatus()).send({
        code: 'HTTP_ERROR',
        message: error.message,
        details: {},
        correlationId,
      });
      return;
    }

    void response.status(500).send({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      details: {},
      correlationId,
    });
  }
}
