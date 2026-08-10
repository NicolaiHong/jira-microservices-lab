package com.example.iam.infrastructure.persistence;

import com.example.iam.domain.model.RefreshToken;
import com.example.iam.domain.port.RefreshTokenRepository;
import com.example.iam.infrastructure.persistence.jpa.RefreshTokenJpaEntity;
import com.example.iam.infrastructure.persistence.jpa.RefreshTokenJpaRepository;
import com.example.iam.infrastructure.persistence.jpa.UserJpaRepository;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class RefreshTokenRepositoryAdapter implements RefreshTokenRepository {
    private final RefreshTokenJpaRepository refreshTokenJpaRepository;
    private final UserJpaRepository userJpaRepository;

    public RefreshTokenRepositoryAdapter(
        RefreshTokenJpaRepository refreshTokenJpaRepository,
        UserJpaRepository userJpaRepository
    ) {
        this.refreshTokenJpaRepository = refreshTokenJpaRepository;
        this.userJpaRepository = userJpaRepository;
    }

    @Override
    public void save(RefreshToken token) {
        refreshTokenJpaRepository.save(toEntity(token));
    }

    @Override
    public Optional<RefreshToken> findByTokenHash(String tokenHash) {
        return refreshTokenJpaRepository.findByTokenHash(tokenHash).map(this::toDomain);
    }

    @Override
    @Transactional
    public boolean rotate(UUID currentTokenId, RefreshToken replacement) {
        if (refreshTokenJpaRepository.revokeActiveById(currentTokenId) != 1) {
            return false;
        }

        refreshTokenJpaRepository.save(toEntity(replacement));
        return true;
    }

    @Override
    @Transactional
    public void revokeIfActive(UUID tokenId) {
        refreshTokenJpaRepository.revokeActiveById(tokenId);
    }

    private RefreshTokenJpaEntity toEntity(RefreshToken token) {
        return new RefreshTokenJpaEntity(
            userJpaRepository.getReferenceById(token.userId()),
            token.tokenHash(),
            token.expiresAt()
        );
    }

    private RefreshToken toDomain(RefreshTokenJpaEntity entity) {
        return new RefreshToken(
            entity.getId(),
            entity.getUserId(),
            entity.getTokenHash(),
            entity.isRevoked(),
            entity.getExpiresAt()
        );
    }
}
