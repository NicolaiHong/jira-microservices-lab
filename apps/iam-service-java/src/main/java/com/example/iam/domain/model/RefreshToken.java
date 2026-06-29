package com.example.iam.domain.model;

import java.time.Instant;
import java.util.UUID;

public record RefreshToken(
    UUID userId,
    String tokenHash,
    Instant expiresAt
) {}
