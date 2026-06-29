import { Injectable } from '@nestjs/common';

type HealthStatus = 'ok' | 'degraded' | 'down';

interface ServiceTarget {
  name: string;
  envName: string;
  defaultUrl: string;
}

interface AggregatedServiceHealth {
  name: string;
  url: string;
  status: HealthStatus;
  latencyMs: number;
  service?: string;
  error?: string;
}

@Injectable()
export class HealthService {
  private readonly targets: ServiceTarget[] = [
    {
      name: 'iam-service',
      envName: 'IAM_SERVICE_URL',
      defaultUrl: 'http://localhost:8081',
    },
    {
      name: 'project-service',
      envName: 'PROJECT_SERVICE_URL',
      defaultUrl: 'http://localhost:8082',
    },
    {
      name: 'issue-service',
      envName: 'ISSUE_SERVICE_URL',
      defaultUrl: 'http://localhost:8083',
    },
    {
      name: 'notification-service',
      envName: 'NOTIFICATION_SERVICE_URL',
      defaultUrl: 'http://localhost:8084',
    },
  ];

  getGatewayHealth() {
    return {
      status: 'ok',
      service: 'api-gateway',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }

  async getServicesHealth() {
    const services = await Promise.all(
      this.targets.map((target) => this.checkService(target)),
    );
    const status: HealthStatus = services.every((service) => service.status === 'ok')
      ? 'ok'
      : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      services,
    };
  }

  private async checkService(
    target: ServiceTarget,
  ): Promise<AggregatedServiceHealth> {
    const baseUrl = process.env[target.envName] ?? target.defaultUrl;
    const url = `${baseUrl.replace(/\/+$/, '')}/health`;
    const timeoutMs = Number(process.env.HEALTH_CHECK_TIMEOUT_MS ?? 1500);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: 'application/json',
        },
      });
      const latencyMs = Date.now() - startedAt;

      if (!response.ok) {
        return {
          name: target.name,
          url,
          status: 'down',
          latencyMs,
          error: `http_${response.status}`,
        };
      }

      const body = (await response.json()) as {
        status?: HealthStatus;
        service?: string;
      };

      return {
        name: target.name,
        url,
        status: body.status === 'ok' ? 'ok' : 'degraded',
        latencyMs,
        service: body.service,
      };
    } catch (error) {
      return {
        name: target.name,
        url,
        status: 'down',
        latencyMs: Date.now() - startedAt,
        error: this.describeError(error),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      return error.name === 'AbortError' ? 'timeout' : error.message;
    }

    return 'unknown_error';
  }
}
