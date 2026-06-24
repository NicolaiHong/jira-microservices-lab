package com.example.iam.health;

import java.util.Map;

public record HealthResponse(
    String status,
    String service,
    String version,
    String timestamp,
    Map<String, String> dependencies
) {}
