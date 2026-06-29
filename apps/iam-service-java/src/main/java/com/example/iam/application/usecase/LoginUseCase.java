package com.example.iam.application.usecase;

import com.example.iam.application.dto.AuthenticatedUserResult;
import com.example.iam.application.dto.LoginCommand;
import com.example.iam.application.dto.LoginResult;
import com.example.iam.domain.ErrorCodes;
import com.example.iam.domain.exception.DomainException;
import com.example.iam.domain.model.RefreshToken;
import com.example.iam.domain.model.User;
import com.example.iam.domain.port.PasswordHasher;
import com.example.iam.domain.port.RefreshTokenRepository;
import com.example.iam.domain.port.TokenProvider;
import com.example.iam.domain.port.UserRepository;
import java.util.Locale;

public final class LoginUseCase {
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordHasher passwordHasher;
    private final TokenProvider tokenProvider;

    public LoginUseCase(
        UserRepository userRepository,
        RefreshTokenRepository refreshTokenRepository,
        PasswordHasher passwordHasher,
        TokenProvider tokenProvider
    ) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordHasher = passwordHasher;
        this.tokenProvider = tokenProvider;
    }

    public LoginResult execute(LoginCommand command) {
        String email = normalizeEmail(command.email());
        User user = userRepository
            .findByEmail(email)
            .orElseThrow(LoginUseCase::invalidCredentials);

        if (!passwordHasher.matches(command.password(), user.getPasswordHash())) {
            throw invalidCredentials();
        }

        if (user.isBlocked()) {
            throw new DomainException(ErrorCodes.UserBlocked, "User is blocked");
        }

        String accessToken = tokenProvider.issueAccessToken(user);
        String refreshToken = tokenProvider.generateRefreshToken();
        refreshTokenRepository.save(
            new RefreshToken(
                user.getId(),
                tokenProvider.hashRefreshToken(refreshToken),
                tokenProvider.refreshTokenExpiresAt()
            )
        );

        return new LoginResult(
            accessToken,
            refreshToken,
            new AuthenticatedUserResult(
                user.getId(),
                user.getEmail(),
                user.sortedRoles()
            )
        );
    }

    private static DomainException invalidCredentials() {
        return new DomainException(
            ErrorCodes.InvalidCredentials,
            "Email or password is invalid"
        );
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
