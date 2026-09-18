package com.example.iam.infrastructure.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class JwtTokenProviderTest {
    private static JwtTokenProvider provider(String secret) {
        return new JwtTokenProvider(secret, 60, 30, "jira-like-iam", "jira-like-api");
    }

    @Test
    void rejectsMissingOrShortSecret() {
        assertThrows(IllegalStateException.class, () -> provider(null));
        assertThrows(IllegalStateException.class, () -> provider(""));
        assertThrows(IllegalStateException.class, () -> provider("x".repeat(31)));
    }

    @Test
    void acceptsSecretOfAtLeast32Bytes() {
        assertDoesNotThrow(() -> provider("x".repeat(32)));
    }
}
