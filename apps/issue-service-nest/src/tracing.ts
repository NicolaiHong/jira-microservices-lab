import type { IncomingMessage } from 'node:http';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { KafkaJsInstrumentation } from '@opentelemetry/instrumentation-kafkajs';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { NodeSDK } from '@opentelemetry/sdk-node';

// Imported first by main.ts: the instrumentations patch http, fastify, fetch,
// pg and kafkajs only for code loaded after this file (ADR 0006). Without an
// OTLP endpoint tracing stays off. Header capture stays off, and no span holds
// credentials, bodies, SQL parameter values or Kafka record values.
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  new NodeSDK({
    textMapPropagator: new W3CTraceContextPropagator(),
    metricReaders: [],
    logRecordProcessors: [],
    instrumentations: [
      new HttpInstrumentation({
        applyCustomAttributesOnSpan: (span, request) => {
          const correlationId = (request as IncomingMessage).headers?.['x-correlation-id'];
          if (typeof correlationId === 'string') {
            span.setAttribute('app.correlation_id', correlationId);
          }
        },
      }),
      new UndiciInstrumentation(),
      new FastifyInstrumentation(),
      // The outbox poller's queries have no parent and would each start a trace.
      new PgInstrumentation({ requireParentSpan: true }),
      new KafkaJsInstrumentation(),
    ],
  }).start();
}
