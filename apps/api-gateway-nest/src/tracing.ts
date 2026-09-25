import type { IncomingMessage } from 'node:http';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { NodeSDK } from '@opentelemetry/sdk-node';

// Imported first by main.ts: the instrumentations patch http, fastify and
// fetch only for code loaded after this file (ADR 0006). Without an OTLP
// endpoint tracing stays off. Header capture stays off, so spans never hold
// credentials, cookies or bodies.
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
    ],
  }).start();
}
