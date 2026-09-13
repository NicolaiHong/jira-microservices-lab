import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { OutboxPublisher } from './outbox.publisher';
import type { IssueRepository } from '../application/ports';

function fixture(sendFails = false, markFails = false) {
  const events = [1, 2].map((n) => ({ eventId: `event-${n}`, eventType: 'issue.updated', aggregateId: 'issue-1', payload: {}, occurredAt: '2026-09-05T00:00:00Z' }));
  const sent: unknown[] = [];
  const published: string[] = [];
  const failed: string[] = [];
  const repository = {
    pendingEvents: async () => events,
    markEventPublished: async (id: string) => { if (markFails && id === 'event-1') throw new Error('database unavailable'); published.push(id); },
    recordPublishFailure: async (id: string) => { failed.push(id); },
  } as unknown as IssueRepository;
  const publisher = new OutboxPublisher(repository);
  Object.defineProperty(publisher, 'producer', { value: {
    connect: async () => {},
    send: async (batch: unknown) => { assert.equal(published.length, 0); sent.push(batch); if (sendFails) throw new Error('broker unavailable'); },
  } });
  const publish = () => (publisher as unknown as { publishBatch(): Promise<void> }).publishBatch();
  return { events, sent, published, failed, publish };
}

test('publishes one ordered Kafka batch with stable aggregate keys and versioned envelopes', async () => {
  const f = fixture();
  await f.publish();
  assert.deepEqual(f.sent, [{ topic: process.env.ISSUE_EVENTS_TOPIC ?? 'issue.events.v1', messages: f.events.map((event) => ({ key: 'issue-1', value: JSON.stringify({ ...event, schemaVersion: 1 }) })) }]);
  assert.deepEqual(f.published, ['event-1', 'event-2']);
  assert.deepEqual(f.failed, []);
});

test('failed delivery leaves every event pending and records a retry for each', async () => {
  const f = fixture(true);
  await f.publish();
  assert.deepEqual(f.published, []);
  assert.deepEqual(f.failed, ['event-1', 'event-2']);
  await f.publish();
  assert.equal(f.sent.length, 2);
});

test('a failed publication marker leaves that event retryable without hiding other acknowledgements', async () => {
  const f = fixture(false, true);
  await f.publish();
  assert.deepEqual(f.published, ['event-2']);
  assert.deepEqual(f.failed, ['event-1']);
});

test('does not send an empty batch', async () => {
  const f = fixture();
  f.events.length = 0;
  await f.publish();
  assert.deepEqual(f.sent, []);
});
