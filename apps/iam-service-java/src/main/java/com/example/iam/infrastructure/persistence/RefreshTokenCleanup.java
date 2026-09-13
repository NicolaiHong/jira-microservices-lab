package com.example.iam.infrastructure.persistence;

import com.example.iam.infrastructure.persistence.jpa.RefreshTokenJpaRepository;
import java.time.Clock;
import java.time.Instant;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class RefreshTokenCleanup {
    private final RefreshTokenJpaRepository repository;
    private final Clock clock;

    public RefreshTokenCleanup(RefreshTokenJpaRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${auth.refresh-token.cleanup-delay-ms:3600000}")
    @Transactional
    public void deleteUnusableTokens() {
        repository.deleteUnusableTokens(Instant.now(clock));
    }
}
