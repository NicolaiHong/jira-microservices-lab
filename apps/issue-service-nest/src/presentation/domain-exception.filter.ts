import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { DomainError } from '../domain/errors';

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    const request = host.switchToHttp().getRequest<FastifyRequest>();
    const correlationId =
      typeof request.headers['x-correlation-id'] === 'string'
        ? request.headers['x-correlation-id']
        : request.id;

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
