package com.example.iam.domain.model;

import java.time.Instant;
import java.util.UUID;

public record RefreshToken(
    UUID id,
    UUID userId,
    String tokenHash,
    boolean revoked,
    Instant expiresAt
) {
    public static RefreshToken issue(
        UUID userId,
        String tokenHash,
        Instant expiresAt
    ) {
        return new RefreshToken(null, userId, tokenHash, false, expiresAt);
    }

    public boolean canBeUsedAt(Instant now) {
        return !revoked && expiresAt.isAfter(now);
    }
}
