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

    @Scheduled(fixedDelay = 3_600_000)
    @Transactional
    public void deleteUnusableTokens() {
        repository.deleteUnusableTokens(Instant.now(clock));
    }
}
