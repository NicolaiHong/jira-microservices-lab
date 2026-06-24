package com.example.iam.health;

import java.time.Instant;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
    @GetMapping("/health")
    public HealthResponse getHealth() {
        return new HealthResponse(
            "ok",
            "iam-service",
            "0.1.0",
            Instant.now().toString(),
            Map.of(
                "database", "not_checked",
                "redis", "not_applicable",
                "kafka", "not_checked"
            )
        );
    }
}
