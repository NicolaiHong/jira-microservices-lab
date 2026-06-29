package com.example.iam.infrastructure.persistence;

import com.example.iam.domain.model.RefreshToken;
import com.example.iam.domain.port.RefreshTokenRepository;
import com.example.iam.infrastructure.persistence.jpa.RefreshTokenJpaEntity;
import com.example.iam.infrastructure.persistence.jpa.RefreshTokenJpaRepository;
import com.example.iam.infrastructure.persistence.jpa.UserJpaRepository;
import org.springframework.stereotype.Repository;

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
        refreshTokenJpaRepository.save(
            new RefreshTokenJpaEntity(
                userJpaRepository.getReferenceById(token.userId()),
                token.tokenHash(),
                token.expiresAt()
            )
        );
    }
}
