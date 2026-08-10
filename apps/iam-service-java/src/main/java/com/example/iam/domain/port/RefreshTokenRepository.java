package com.example.iam.domain.port;

import com.example.iam.domain.model.RefreshToken;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository {
    void save(RefreshToken token);

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    boolean rotate(UUID currentTokenId, RefreshToken replacement);

    void revokeIfActive(UUID tokenId);
}
