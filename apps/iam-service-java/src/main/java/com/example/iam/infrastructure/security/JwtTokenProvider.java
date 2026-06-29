package com.example.iam.infrastructure.security;

import com.example.iam.domain.model.User;
import com.example.iam.domain.port.TokenProvider;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtTokenProvider implements TokenProvider {
    private final SecretKey signingKey;
    private final long accessTokenTtlMinutes;
    private final long refreshTokenTtlDays;
    private final SecureRandom secureRandom = new SecureRandom();

    public JwtTokenProvider(
        @Value("${auth.jwt.secret}") String secret,
        @Value("${auth.jwt.access-token-ttl-minutes}") long accessTokenTtlMinutes,
        @Value("${auth.refresh-token.ttl-days}") long refreshTokenTtlDays
    ) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenTtlMinutes = accessTokenTtlMinutes;
        this.refreshTokenTtlDays = refreshTokenTtlDays;
    }

    @Override
    public String issueAccessToken(User user) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(accessTokenTtlMinutes, ChronoUnit.MINUTES);

        return Jwts.builder()
            .subject(user.getId().toString())
            .claim("email", user.getEmail())
            .claim("roles", user.sortedRoles())
            .issuedAt(Date.from(now))
            .expiration(Date.from(expiresAt))
            .signWith(signingKey)
            .compact();
    }

    @Override
    public String generateRefreshToken() {
        byte[] randomBytes = new byte[48];
        secureRandom.nextBytes(randomBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
    }

    @Override
    public String hashRefreshToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hashed);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    @Override
    public Instant refreshTokenExpiresAt() {
        return Instant.now().plus(refreshTokenTtlDays, ChronoUnit.DAYS);
    }
}
