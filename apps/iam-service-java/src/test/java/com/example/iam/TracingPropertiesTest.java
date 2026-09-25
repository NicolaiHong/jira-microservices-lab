package com.example.iam;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Map;
import org.junit.jupiter.api.Test;

class TracingPropertiesTest {
    @Test
    void disablesTracingWithoutAnOtlpEndpoint() {
        assertEquals(Map.of("management.tracing.enabled", false), IamServiceApplication.tracingProperties(null));
        assertEquals(Map.of("management.tracing.enabled", false), IamServiceApplication.tracingProperties(" "));
    }

    @Test
    void exportsToTheOtlpHttpTracesPath() {
        assertEquals(
            Map.of("management.otlp.tracing.endpoint", "http://jaeger:4318/v1/traces"),
            IamServiceApplication.tracingProperties("http://jaeger:4318/")
        );
    }
}
