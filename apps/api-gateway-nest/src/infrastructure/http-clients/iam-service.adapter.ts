import { Injectable } from '@nestjs/common';
import { InternalServiceHttpClient } from './internal-service-http.client';

@Injectable()
export class IamServiceAdapter {
  private readonly client = new InternalServiceHttpClient({
    service: 'iam-service',
    baseUrl: process.env.IAM_SERVICE_URL ?? 'http://localhost:8081',
    requestErrorCode: 'IAM_AUTH_ERROR',
    requestErrorMessage: 'IAM auth request failed',
    unavailableCode: 'IAM_SERVICE_UNAVAILABLE',
    unavailableMessage: 'IAM service is unavailable',
    objectResponseOnly: true,
    nonemptyErrorStrings: true,
  });

  register(body: unknown, correlationId: string): Promise<unknown> {
    return this.forwardToIam('register', body, correlationId);
  }

  login(body: unknown, correlationId: string): Promise<unknown> {
    return this.forwardToIam('login', body, correlationId);
  }

  refresh(body: unknown, correlationId: string): Promise<unknown> {
    return this.forwardToIam('refresh', body, correlationId);
  }

  logout(body: unknown, correlationId: string): Promise<unknown> {
    return this.forwardToIam('logout', body, correlationId);
  }

  private forwardToIam(path: string, body: unknown, correlationId: string): Promise<unknown> {
    return this.client.forward('POST', `/auth/${path}`, body, { correlationId });
  }
}
