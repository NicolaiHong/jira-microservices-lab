import { Controller, Get, Inject } from '@nestjs/common';
import {
  ISSUE_REPOSITORY,
  type IssueRepository,
  type OutboxStatus,
} from '../application/ports';
import { OutboxPublisher } from '../infrastructure/outbox.publisher';

const STALE_PENDING_SECONDS = 300;

@Controller('health')
export class HealthController {
  constructor(
    @Inject(ISSUE_REPOSITORY) private readonly issues: IssueRepository,
    private readonly publisher: OutboxPublisher,
  ) {}

  @Get()
  async getHealth() {
    let outbox: OutboxStatus | null = null;
    try {
      outbox = await this.issues.outboxStatus();
    } catch {
      outbox = null;
    }
    const kafka = this.publisher.isConnected ? 'ok' : 'down';
    const outboxHealthy =
      outbox !== null &&
      outbox.abandoned === 0 &&
      (outbox.oldestPendingSeconds ?? 0) < STALE_PENDING_SECONDS;

    return {
      status: outboxHealthy && kafka === 'ok' ? 'ok' : 'degraded',
      service: 'issue-service',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: outbox ? 'ok' : 'down',
        redis: 'not_applicable',
        kafka,
      },
      outbox,
    };
  }
}
