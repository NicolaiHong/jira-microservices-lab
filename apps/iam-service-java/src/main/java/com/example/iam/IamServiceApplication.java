package com.example.iam;

import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class IamServiceApplication {
    public static void main(String[] args) {
        SpringApplication application = new SpringApplication(IamServiceApplication.class);
        application.setDefaultProperties(tracingProperties(System.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")));
        application.run(args);
    }

    /** Tracing is off without an OTLP endpoint; with one, spans go to its OTLP/HTTP traces path (ADR 0006). */
    static Map<String, Object> tracingProperties(String otlpEndpoint) {
        if (otlpEndpoint == null || otlpEndpoint.isBlank()) {
            return Map.of("management.tracing.enabled", false);
        }
        return Map.of(
            "management.otlp.tracing.endpoint",
            otlpEndpoint.trim().replaceAll("/+$", "") + "/v1/traces"
        );
    }
}
