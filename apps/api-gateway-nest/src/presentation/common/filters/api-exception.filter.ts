import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppException } from '../../../domain/errors/app.exception';
import { getCorrelationId } from '../errors/correlation-id';

interface HttpExceptionResponse {
  code?: unknown;
  message?: unknown;
  details?: unknown;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<FastifyReply>();
    const request = context.getRequest<FastifyRequest>();
    const apiError = this.toApiError(exception);

    response.status(apiError.statusCode).send({
      code: apiError.code,
      message: apiError.message,
      correlationId: getCorrelationId(request),
      details: apiError.details,
    });
  }

  private toApiError(exception: unknown): AppException {
    if (exception instanceof AppException) {
      return exception;
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();
      const body = this.isObject(response)
        ? (response as HttpExceptionResponse)
        : {};

      return new AppException(
        statusCode,
        this.stringOrDefault(body.code, `HTTP_${statusCode}`),
        this.stringOrDefault(body.message, exception.message),
        this.objectOrEmpty(body.details),
      );
    }

    return new AppException(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'INTERNAL_ERROR',
      'Unexpected server error',
    );
  }

  private stringOrDefault(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.length > 0 ? value : fallback;
  }

  private objectOrEmpty(value: unknown): Record<string, unknown> {
    return this.isObject(value) ? value : {};
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
