package com.example.iam.infrastructure.persistence.jpa;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserJpaRepository extends JpaRepository<UserJpaEntity, UUID> {
    boolean existsByEmailIgnoreCase(String email);

    Optional<UserJpaEntity> findByEmailIgnoreCase(String email);
}
