package com.example.iam.application.usecase;

import com.example.iam.application.dto.LogoutCommand;
import com.example.iam.domain.port.RefreshTokenRepository;
import com.example.iam.domain.port.TokenProvider;

public final class LogoutUseCase {
    private final RefreshTokenRepository refreshTokenRepository;
    private final TokenProvider tokenProvider;

    public LogoutUseCase(
        RefreshTokenRepository refreshTokenRepository,
        TokenProvider tokenProvider
    ) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.tokenProvider = tokenProvider;
    }

    public void execute(LogoutCommand command) {
        String tokenHash = tokenProvider.hashRefreshToken(command.refreshToken());
        refreshTokenRepository
            .findByTokenHash(tokenHash)
            .ifPresent(token -> refreshTokenRepository.revokeIfActive(token.id()));
    }
}
