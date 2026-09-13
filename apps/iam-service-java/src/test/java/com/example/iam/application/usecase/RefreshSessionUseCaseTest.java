package com.example.iam.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.example.iam.application.dto.RefreshSessionCommand;
import com.example.iam.domain.ErrorCodes;
import com.example.iam.domain.exception.DomainException;
import com.example.iam.domain.model.RefreshToken;
import com.example.iam.domain.model.User;
import com.example.iam.domain.model.UserStatus;
import com.example.iam.domain.port.RefreshTokenRepository;
import com.example.iam.domain.port.TokenProvider;
import com.example.iam.domain.port.UserRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RefreshSessionUseCaseTest {
    @Test
    void rotatesRefreshTokenAndRejectsReplay() {
        UUID userId = UUID.randomUUID();
        User user = new User(
            userId,
            "learner@example.com",
            "hash",
            UserStatus.ACTIVE,
            true,
            Set.of("MEMBER")
        );
        FakeUserRepository users = new FakeUserRepository(user);
        FakeTokenProvider tokens = new FakeTokenProvider();
        FakeRefreshTokenRepository refreshTokens = new FakeRefreshTokenRepository();
        refreshTokens.save(new RefreshToken(
            UUID.randomUUID(),
            userId,
            tokens.hashRefreshToken("original"),
            false,
            Instant.now().plus(1, ChronoUnit.DAYS)
        ));
        RefreshSessionUseCase useCase = new RefreshSessionUseCase(users, refreshTokens, tokens);

        var result = useCase.execute(new RefreshSessionCommand("original"));

        assertNotEquals("original", result.refreshToken());
        assertEquals("access-token", result.accessToken());
        DomainException replay = assertThrows(
            DomainException.class,
            () -> useCase.execute(new RefreshSessionCommand("original"))
        );
        assertEquals(ErrorCodes.InvalidRefreshToken, replay.getErrorCode());
    }

    private static final class FakeTokenProvider implements TokenProvider {
        private int sequence;
        public String issueAccessToken(User user) { return "access-token"; }
        public String generateRefreshToken() { return "replacement-" + (++sequence); }
        public String hashRefreshToken(String token) { return "hash:" + token; }
        public Instant refreshTokenExpiresAt() { return Instant.now().plus(30, ChronoUnit.DAYS); }
    }

    private static final class FakeRefreshTokenRepository implements RefreshTokenRepository {
        private final Map<String, RefreshToken> byHash = new HashMap<>();
        public void save(RefreshToken token) { byHash.put(token.tokenHash(), withId(token)); }
        public Optional<RefreshToken> findByTokenHash(String tokenHash) { return Optional.ofNullable(byHash.get(tokenHash)); }
        public boolean rotate(UUID currentTokenId, RefreshToken replacement) {
            RefreshToken current = byHash.values().stream()
                .filter(token -> currentTokenId.equals(token.id()) && !token.revoked())
                .findFirst().orElse(null);
            if (current == null) return false;
            byHash.put(current.tokenHash(), new RefreshToken(current.id(), current.userId(), current.tokenHash(), true, current.expiresAt()));
            save(replacement);
            return true;
        }
        public void revokeIfActive(UUID tokenId) {
            byHash.values().stream().filter(token -> tokenId.equals(token.id())).findFirst()
                .ifPresent(token -> byHash.put(token.tokenHash(), new RefreshToken(token.id(), token.userId(), token.tokenHash(), true, token.expiresAt())));
        }
        private RefreshToken withId(RefreshToken token) {
            return token.id() == null
                ? new RefreshToken(UUID.randomUUID(), token.userId(), token.tokenHash(), token.revoked(), token.expiresAt())
                : token;
        }
    }

    private static final class FakeUserRepository implements UserRepository {
        private final User user;
        private FakeUserRepository(User user) { this.user = user; }
        public Optional<User> findByEmail(String email) { return Optional.empty(); }
        public Optional<User> findById(UUID id) { return user.getId().equals(id) ? Optional.of(user) : Optional.empty(); }
        public boolean existsByEmail(String email) { return false; }
        public User save(User value) { return value; }
    }
}
