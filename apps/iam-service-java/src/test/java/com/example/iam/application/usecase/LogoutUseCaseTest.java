package com.example.iam.application.usecase;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.iam.application.dto.LogoutCommand;
import com.example.iam.domain.model.RefreshToken;
import com.example.iam.domain.port.RefreshTokenRepository;
import com.example.iam.domain.port.TokenProvider;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class LogoutUseCaseTest {
    private final RefreshTokenRepository refreshTokens = mock(RefreshTokenRepository.class);
    private final TokenProvider tokenProvider = mock(TokenProvider.class);
    private final LogoutUseCase useCase = new LogoutUseCase(refreshTokens, tokenProvider);

    @Test
    void revokesTheMatchingTokenWhenFound() {
        UUID tokenId = UUID.randomUUID();
        RefreshToken token = new RefreshToken(
            tokenId, UUID.randomUUID(), "hash", false, Instant.now().plusSeconds(60)
        );
        when(tokenProvider.hashRefreshToken("raw-token")).thenReturn("hash");
        when(refreshTokens.findByTokenHash("hash")).thenReturn(Optional.of(token));

        useCase.execute(new LogoutCommand("raw-token"));

        verify(refreshTokens).revokeIfActive(tokenId);
    }

    @Test
    void isANoOpWhenTokenIsUnknown() {
        when(tokenProvider.hashRefreshToken("raw-token")).thenReturn("hash");
        when(refreshTokens.findByTokenHash("hash")).thenReturn(Optional.empty());

        useCase.execute(new LogoutCommand("raw-token"));

        verify(refreshTokens, never()).revokeIfActive(org.mockito.ArgumentMatchers.any());
    }
}
