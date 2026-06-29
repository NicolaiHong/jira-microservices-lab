package com.example.iam.infrastructure.persistence.jpa;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RefreshTokenJpaRepository
    extends JpaRepository<RefreshTokenJpaEntity, UUID> {}
