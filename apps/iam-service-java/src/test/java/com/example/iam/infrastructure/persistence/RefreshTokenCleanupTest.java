package com.example.iam.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import com.example.iam.infrastructure.persistence.jpa.RefreshTokenJpaEntity;
import com.example.iam.infrastructure.persistence.jpa.RefreshTokenJpaRepository;
import com.example.iam.infrastructure.persistence.jpa.UserJpaEntity;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

@DataJpaTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
class RefreshTokenCleanupTest {
    @Autowired RefreshTokenJpaRepository repository;
    @Autowired TestEntityManager entities;

    @Test
    void removesExpiredAndRevokedTokensButPreservesActiveTokensAndUsers() {
        Instant now = Instant.parse("2026-09-05T00:00:00Z");
        var user = entities.persistAndFlush(new UserJpaEntity("cleanup@example.test", "hash"));
        var active = repository.saveAndFlush(new RefreshTokenJpaEntity(user, "active", now.plusSeconds(600)));
        repository.saveAndFlush(new RefreshTokenJpaEntity(user, "expired", now.minusSeconds(1)));
        var boundary = repository.saveAndFlush(new RefreshTokenJpaEntity(user, "boundary", now));
        var revoked = repository.saveAndFlush(new RefreshTokenJpaEntity(user, "revoked", now.plusSeconds(600)));
        repository.revokeActiveById(revoked.getId());
        var cleanup = new RefreshTokenCleanup(repository, Clock.fixed(now, ZoneOffset.UTC));
        cleanup.deleteUnusableTokens();
        entities.clear();
        assertEquals(2, repository.count());
        assertTrue(repository.findById(active.getId()).isPresent());
        assertTrue(repository.findById(boundary.getId()).isPresent());
        assertTrue(entities.find(UserJpaEntity.class, user.getId()) != null);
        cleanup.deleteUnusableTokens();
        assertEquals(2, repository.count());
    }
}
