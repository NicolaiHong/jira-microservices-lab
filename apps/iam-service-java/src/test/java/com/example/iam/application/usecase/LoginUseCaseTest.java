package com.example.iam.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.iam.application.dto.LoginCommand;
import com.example.iam.domain.ErrorCodes;
import com.example.iam.domain.exception.DomainException;
import com.example.iam.domain.model.User;
import com.example.iam.domain.model.UserStatus;
import com.example.iam.domain.port.PasswordHasher;
import com.example.iam.domain.port.RefreshTokenRepository;
import com.example.iam.domain.port.TokenProvider;
import com.example.iam.domain.port.UserRepository;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class LoginUseCaseTest {
    private final UserRepository users = mock(UserRepository.class);
    private final RefreshTokenRepository refreshTokens = mock(RefreshTokenRepository.class);
    private final PasswordHasher passwordHasher = mock(PasswordHasher.class);
    private final TokenProvider tokenProvider = mock(TokenProvider.class);
    private final LoginUseCase useCase =
        new LoginUseCase(users, refreshTokens, passwordHasher, tokenProvider);

    private User activeUser(UserStatus status) {
        return new User(
            UUID.randomUUID(),
            "user@example.test",
            "hashed",
            status,
            true,
            Set.of("MEMBER")
        );
    }

    @Test
    void unknownEmailIsRejectedAsInvalidCredentials() {
        when(users.findByEmail("user@example.test")).thenReturn(Optional.empty());

        DomainException ex = assertThrows(
            DomainException.class,
            () -> useCase.execute(new LoginCommand("user@example.test", "password123"))
        );
        assertEquals(ErrorCodes.InvalidCredentials, ex.getErrorCode());
    }

    @Test
    void wrongPasswordIsRejectedAsInvalidCredentials() {
        User user = activeUser(UserStatus.ACTIVE);
        when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(passwordHasher.matches("wrong", user.getPasswordHash())).thenReturn(false);

        DomainException ex = assertThrows(
            DomainException.class,
            () -> useCase.execute(new LoginCommand(user.getEmail(), "wrong"))
        );
        assertEquals(ErrorCodes.InvalidCredentials, ex.getErrorCode());
        verify(tokenProvider, never()).issueAccessToken(any());
    }

    @Test
    void blockedUserIsRejectedEvenWithCorrectPassword() {
        User user = activeUser(UserStatus.BLOCKED);
        when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(passwordHasher.matches("password123", user.getPasswordHash())).thenReturn(true);

        DomainException ex = assertThrows(
            DomainException.class,
            () -> useCase.execute(new LoginCommand(user.getEmail(), "password123"))
        );
        assertEquals(ErrorCodes.UserBlocked, ex.getErrorCode());
        verify(tokenProvider, never()).issueAccessToken(any());
    }

    @Test
    void validCredentialsIssueTokensAndPersistRefreshToken() {
        User user = activeUser(UserStatus.ACTIVE);
        when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(passwordHasher.matches("password123", user.getPasswordHash())).thenReturn(true);
        when(tokenProvider.issueAccessToken(user)).thenReturn("access-token");
        when(tokenProvider.generateRefreshToken()).thenReturn("refresh-token");
        when(tokenProvider.hashRefreshToken("refresh-token")).thenReturn("refresh-token-hash");
        Instant expiresAt = Instant.now().plusSeconds(3600);
        when(tokenProvider.refreshTokenExpiresAt()).thenReturn(expiresAt);

        var result = useCase.execute(new LoginCommand(user.getEmail(), "password123"));

        assertEquals("access-token", result.accessToken());
        assertEquals("refresh-token", result.refreshToken());
        assertEquals(user.getId(), result.user().id());
        verify(refreshTokens).save(argThat(token ->
            token.userId().equals(user.getId())
                && token.tokenHash().equals("refresh-token-hash")
                && token.expiresAt().equals(expiresAt)
                && !token.revoked()
        ));
    }

    private static com.example.iam.domain.model.RefreshToken argThat(
        java.util.function.Predicate<com.example.iam.domain.model.RefreshToken> predicate
    ) {
        return org.mockito.ArgumentMatchers.argThat(predicate::test);
    }
}
