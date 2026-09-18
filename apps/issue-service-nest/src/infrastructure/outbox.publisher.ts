import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Kafka, type Producer } from 'kafkajs';
import {
  ISSUE_REPOSITORY,
  type IssueRepository,
} from '../application/ports';

@Injectable()
export class OutboxPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisher.name);
  private readonly producer: Producer;
  private timer?: NodeJS.Timeout;
  private running = false;
  private connected = false;

  get isConnected(): boolean {
    return this.connected;
  }

  constructor(
    @Inject(ISSUE_REPOSITORY) private readonly issues: IssueRepository,
  ) {
    const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092')
      .split(',')
      .map((broker) => broker.trim())
      .filter(Boolean);
    this.producer = new Kafka({ clientId: 'issue-service', brokers }).producer();
  }

  onModuleInit(): void {
    this.timer = setInterval(() => void this.publishBatch(), 2000);
    void this.publishBatch();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
    }
    if (this.connected) {
      await this.producer.disconnect();
    }
  }

  private async publishBatch(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      if (!this.connected) {
        await this.producer.connect();
        this.connected = true;
      }
      const events = await this.issues.pendingEvents(50);
      if (events.length === 0) return;
      try {
        await this.producer.send({
          topic: process.env.ISSUE_EVENTS_TOPIC ?? 'issue.events.v1',
          messages: events.map((event) => ({
            key: event.aggregateId,
            value: JSON.stringify({ ...event, schemaVersion: 1 }),
          })),
        });
      } catch (error) {
        // A batch can have partial broker delivery. Keep every row pending;
        // deterministic event IDs make retries safe for the consumer.
        for (const event of events) {
          await this.recordFailure(event.eventId, error);
        }
        throw error;
      }
      for (const event of events) {
        try {
          await this.issues.markEventPublished(event.eventId);
          this.logger.log(
            JSON.stringify({
              service: 'issue-service',
              eventId: event.eventId,
              eventType: event.eventType,
              aggregateId: event.aggregateId,
              message: 'outbox_event_published',
            }),
          );
        } catch (error) {
          await this.recordFailure(event.eventId, error);
          this.logger.error(
            JSON.stringify({
              service: 'issue-service',
              eventId: event.eventId,
              message: 'outbox_event_publish_failed',
              error: describe(error),
            }),
          );
        }
      }
    } catch (error) {
      this.connected = false;
      this.logger.warn(
        JSON.stringify({
          service: 'issue-service',
          message: 'outbox_publisher_unavailable',
          error: describe(error),
        }),
      );
    } finally {
      this.running = false;
    }
  }

  private async recordFailure(eventId: string, error: unknown): Promise<void> {
    const { attempts, abandoned } = await this.issues.recordPublishFailure(
      eventId,
      describe(error),
    );
    if (abandoned) {
      this.logger.error(
        JSON.stringify({
          service: 'issue-service',
          eventId,
          attempts,
          message: 'outbox_event_abandoned',
          error: describe(error),
        }),
      );
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
