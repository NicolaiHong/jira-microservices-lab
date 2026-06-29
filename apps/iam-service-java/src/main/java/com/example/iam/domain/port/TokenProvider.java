package com.example.iam.domain.port;

import com.example.iam.domain.model.User;
import java.time.Instant;

public interface TokenProvider {
    String issueAccessToken(User user);

    String generateRefreshToken();

    String hashRefreshToken(String token);

    Instant refreshTokenExpiresAt();
}
