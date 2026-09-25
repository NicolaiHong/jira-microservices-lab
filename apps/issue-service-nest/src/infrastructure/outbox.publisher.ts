import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { context, propagation, ROOT_CONTEXT } from '@opentelemetry/api';
import { Kafka, type Producer } from 'kafkajs';
import {
  ISSUE_REPOSITORY,
  type ClaimedOutboxEvent,
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
      const events = await this.issues.claimPendingEvents(50);
      if (events.length === 0) return;
      // A poll claims at most one event per issue (ADR 0004), so sending the
      // events concurrently keeps per-issue order.
      const sends = await Promise.allSettled(events.map((event) => this.send(event)));
      const failed = sends.find(
        (send): send is PromiseRejectedResult => send.status === 'rejected',
      );
      if (failed) {
        // Other sends of the batch may have been delivered. Keep every row
        // pending; deterministic event IDs make retries safe for the consumer.
        for (const event of events) {
          await this.recordFailure(event.eventId, failed.reason);
        }
        throw failed.reason;
      }
      try {
        await this.issues.markEventsPublished(events.map((event) => event.eventId));
      } catch (error) {
        // Delivered but not marked: the batch stays pending and is redelivered
        // after backoff; consumers deduplicate by eventId.
        this.logger.error(
          JSON.stringify({
            service: 'issue-service',
            eventIds: events.map((event) => event.eventId),
            message: 'outbox_event_publish_failed',
            error: describe(error),
          }),
        );
        for (const event of events) {
          await this.recordFailure(event.eventId, error);
        }
        return;
      }
      for (const event of events) {
        this.logger.log(
          JSON.stringify({
            service: 'issue-service',
            eventId: event.eventId,
            eventType: event.eventType,
            aggregateId: event.aggregateId,
            message: 'outbox_event_published',
          }),
        );
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

  // Sends under the trace context stored with the event, so the kafkajs
  // producer span continues the writing request's trace and puts its
  // traceparent into the record headers (ADR 0006). The envelope never
  // carries the trace context.
  private send({ traceContext, ...event }: ClaimedOutboxEvent): Promise<unknown> {
    return context.with(propagation.extract(ROOT_CONTEXT, traceContext ?? {}), () =>
      this.producer.send({
        topic: process.env.ISSUE_EVENTS_TOPIC ?? 'issue.events.v1',
        messages: [
          { key: event.aggregateId, value: JSON.stringify({ ...event, schemaVersion: 1 }) },
        ],
      }),
    );
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
