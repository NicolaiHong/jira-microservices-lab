package com.example.iam.application.usecase;

import com.example.iam.application.dto.AuthenticatedUserResult;
import com.example.iam.application.dto.LoginResult;
import com.example.iam.application.dto.RefreshSessionCommand;
import com.example.iam.domain.ErrorCodes;
import com.example.iam.domain.exception.DomainException;
import com.example.iam.domain.model.RefreshToken;
import com.example.iam.domain.model.User;
import com.example.iam.domain.port.RefreshTokenRepository;
import com.example.iam.domain.port.TokenProvider;
import com.example.iam.domain.port.UserRepository;
import java.time.Instant;

public final class RefreshSessionUseCase {
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final TokenProvider tokenProvider;

    public RefreshSessionUseCase(
        UserRepository userRepository,
        RefreshTokenRepository refreshTokenRepository,
        TokenProvider tokenProvider
    ) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.tokenProvider = tokenProvider;
    }

    public LoginResult execute(RefreshSessionCommand command) {
        String suppliedTokenHash = tokenProvider.hashRefreshToken(command.refreshToken());
        RefreshToken currentToken = refreshTokenRepository
            .findByTokenHash(suppliedTokenHash)
            .filter(token -> token.canBeUsedAt(Instant.now()))
            .orElseThrow(RefreshSessionUseCase::invalidRefreshToken);
        User user = userRepository
            .findById(currentToken.userId())
            .orElseThrow(RefreshSessionUseCase::invalidRefreshToken);

        if (user.isBlocked()) {
            throw new DomainException(ErrorCodes.UserBlocked, "User is blocked");
        }

        String replacementRawToken = tokenProvider.generateRefreshToken();
        RefreshToken replacement = RefreshToken.issue(
            user.getId(),
            tokenProvider.hashRefreshToken(replacementRawToken),
            tokenProvider.refreshTokenExpiresAt()
        );

        if (!refreshTokenRepository.rotate(currentToken.id(), replacement)) {
            throw invalidRefreshToken();
        }

        return new LoginResult(
            tokenProvider.issueAccessToken(user),
            replacementRawToken,
            new AuthenticatedUserResult(
                user.getId(),
                user.getEmail(),
                user.sortedRoles()
            )
        );
    }

    private static DomainException invalidRefreshToken() {
        return new DomainException(
            ErrorCodes.InvalidRefreshToken,
            "Refresh token is invalid or expired"
        );
    }
}
