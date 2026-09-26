import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { KafkaJsInstrumentation } from '@opentelemetry/instrumentation-kafkajs';
import { node, tracing } from '@opentelemetry/sdk-node';
import { OutboxPublisher } from './outbox.publisher';
import type { ClaimedOutboxEvent, IssueRepository } from '../application/ports';

const topic = process.env.ISSUE_EVENTS_TOPIC ?? 'issue.events.v1';

function fixture(sendFails = false, markFails = false, abandonAt = Infinity) {
  const events = [1, 2].map((n) => ({ eventId: `event-${n}`, eventType: 'issue.updated', aggregateId: `issue-${n}`, payload: {}, occurredAt: '2026-09-05T00:00:00Z', traceContext: null })) as unknown as ClaimedOutboxEvent[];
  const sent: unknown[] = [];
  const published: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];
  const logged: string[] = [];
  const repository = {
    claimPendingEvents: async () => events,
    markEventsPublished: async (ids: string[]) => { if (markFails) throw new Error('database unavailable'); published.push(...ids); },
    recordPublishFailure: async (id: string, error: string) => {
      failed.push({ id, error });
      const attempts = failed.filter((entry) => entry.id === id).length;
      return { attempts, abandoned: attempts >= abandonAt };
    },
  } as unknown as IssueRepository;
  const publisher = new OutboxPublisher(repository);
  Object.defineProperty(publisher, 'producer', { value: {
    connect: async () => {},
    send: async (batch: unknown) => { assert.equal(published.length, 0); sent.push(batch); if (sendFails) throw new Error('broker unavailable'); },
  } });
  Object.defineProperty(publisher, 'logger', { value: {
    log: () => {},
    warn: () => {},
    error: (line: string) => logged.push(line),
  } });
  const publish = () => (publisher as unknown as { publishBatch(): Promise<void> }).publishBatch();
  return { events, sent, published, failed, logged, publish, publisher };
}

test('publishes each event with its aggregate key and a versioned envelope without trace context', async () => {
  const f = fixture();
  f.events[0].traceContext = { traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' };
  await f.publish();
  assert.deepEqual(f.sent, f.events.map(({ traceContext: _traceContext, ...event }) => ({
    topic,
    messages: [{ key: event.aggregateId, value: JSON.stringify({ ...event, schemaVersion: 1 }) }],
  })));
  assert.deepEqual(f.published, ['event-1', 'event-2']);
  assert.deepEqual(f.failed, []);
  assert.equal(f.publisher.isConnected, true);
});

test('failed delivery leaves every event pending and records the error for each', async () => {
  const f = fixture(true);
  await f.publish();
  assert.deepEqual(f.published, []);
  assert.deepEqual(f.failed, [
    { id: 'event-1', error: 'broker unavailable' },
    { id: 'event-2', error: 'broker unavailable' },
  ]);
  assert.equal(f.publisher.isConnected, false);
  await f.publish();
  assert.equal(f.sent.length, 4);
});

test('a failed send keeps the whole batch pending even when another send succeeded', async () => {
  const f = fixture();
  Object.defineProperty(f.publisher, 'producer', { value: {
    connect: async () => {},
    send: async (record: { messages: Array<{ key: string }> }) => {
      if (record.messages[0].key === 'issue-2') throw new Error('broker unavailable');
    },
  } });
  await f.publish();
  assert.deepEqual(f.published, []);
  assert.deepEqual(f.failed.map((entry) => entry.id), ['event-1', 'event-2']);
});

test('a failed publication marker keeps the whole batch retryable', async () => {
  const f = fixture(false, true);
  await f.publish();
  assert.deepEqual(f.published, []);
  assert.deepEqual(f.failed, [
    { id: 'event-1', error: 'database unavailable' },
    { id: 'event-2', error: 'database unavailable' },
  ]);
  assert.equal(f.logged.filter((line) => line.includes('outbox_event_publish_failed')).length, 1);
});

test('logs an abandoned event once its attempt budget is exhausted', async () => {
  const f = fixture(true, false, 2);
  await f.publish();
  assert.equal(f.logged.filter((line) => line.includes('outbox_event_abandoned')).length, 0);
  await f.publish();
  const abandoned = f.logged
    .map((line) => JSON.parse(line) as { message: string; eventId: string; attempts: number })
    .filter((entry) => entry.message === 'outbox_event_abandoned');
  assert.deepEqual(abandoned.map((entry) => [entry.eventId, entry.attempts]), [['event-1', 2], ['event-2', 2]]);
});

test('does not send an empty batch', async () => {
  const f = fixture();
  f.events.length = 0;
  await f.publish();
  assert.deepEqual(f.sent, []);
});

test('the Kafka record carries the trace of the request that wrote the event', async () => {
  const exporter = new tracing.InMemorySpanExporter();
  const provider = new node.NodeTracerProvider({
    spanProcessors: [new tracing.SimpleSpanProcessor(exporter)],
  });
  provider.register({ propagator: new W3CTraceContextPropagator() });
  const instrumentation = new KafkaJsInstrumentation();
  instrumentation.setTracerProvider(provider);
  // A stand-in kafkajs module: the patched send starts the producer span and
  // writes its traceparent into the record headers before calling this send.
  const records: Array<{ messages: Array<{ value: string; headers: Record<string, string> }> }> = [];
  class Kafka {
    producer() {
      return { connect: async () => {}, send: async (record: (typeof records)[number]) => { records.push(record); } };
    }
  }
  instrumentation.getModuleDefinitions()[0].patch?.({ Kafka }, '2.2.4');
  const f = fixture();
  Object.defineProperty(f.publisher, 'producer', { value: new Kafka().producer() });
  const writerTraceId = '0af7651916cd43dd8448eb211c80319c';
  const writerSpanId = 'b7ad6b7169203331';
  f.events[0].traceContext = { traceparent: `00-${writerTraceId}-${writerSpanId}-01` };

  await f.publish();

  const [written, untraced] = records.map((record) => record.messages[0]);
  const [, traceId, spanId] = written.headers.traceparent.split('-');
  assert.equal(traceId, writerTraceId);
  const producerSpan = exporter.getFinishedSpans().find((span) => span.spanContext().spanId === spanId);
  assert.equal(producerSpan?.parentSpanContext?.spanId, writerSpanId);
  assert.notEqual(untraced.headers.traceparent.split('-')[1], writerTraceId);
  assert.equal('traceContext' in JSON.parse(written.value), false);
  assert.deepEqual(f.published, ['event-1', 'event-2']);
  await provider.shutdown();
});
