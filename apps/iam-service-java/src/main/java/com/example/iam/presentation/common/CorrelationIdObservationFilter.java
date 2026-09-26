package com.example.iam.presentation.common;

import io.micrometer.common.KeyValue;
import io.micrometer.observation.Observation;
import io.micrometer.observation.ObservationFilter;
import org.springframework.http.server.observation.ServerRequestObservationContext;
import org.springframework.stereotype.Component;

/**
 * Tags the HTTP server span with the request's correlation ID (ADR 0006).
 * CorrelationIdFilter runs before the observation starts, so the ID is read
 * from the request attribute it sets.
 */
@Component
public class CorrelationIdObservationFilter implements ObservationFilter {
    @Override
    public Observation.Context map(Observation.Context context) {
        if (context instanceof ServerRequestObservationContext server
            && server.getCarrier().getAttribute(CorrelationIdContext.RequestAttribute)
                instanceof String correlationId) {
            context.addHighCardinalityKeyValue(KeyValue.of("app.correlation_id", correlationId));
        }
        return context;
    }
}
