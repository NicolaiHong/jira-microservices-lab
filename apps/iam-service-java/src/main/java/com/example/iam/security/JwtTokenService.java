package com.example.iam.security;

import com.example.iam.user.UserEntity;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtTokenService {
    private final SecretKey signingKey;
    private final long accessTokenTtlMinutes;

    public JwtTokenService(
        @Value("${auth.jwt.secret}") String secret,
        @Value("${auth.jwt.access-token-ttl-minutes}") long accessTokenTtlMinutes
    ) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenTtlMinutes = accessTokenTtlMinutes;
    }

    public String issueAccessToken(UserEntity user) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(accessTokenTtlMinutes, ChronoUnit.MINUTES);

        return Jwts.builder()
            .subject(user.getId().toString())
            .claim("email", user.getEmail())
            .claim("roles", user.getRoles().stream().sorted().toList())
            .issuedAt(Date.from(now))
            .expiration(Date.from(expiresAt))
            .signWith(signingKey)
            .compact();
    }
}
