package com.example.iam.infrastructure.persistence.jpa;

import com.example.iam.domain.model.UserIdentity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserJpaRepository extends JpaRepository<UserJpaEntity, UUID> {
    boolean existsByEmailIgnoreCase(String email);

    Optional<UserJpaEntity> findByEmailIgnoreCase(String email);

    @Query("select new com.example.iam.domain.model.UserIdentity(u.id, u.email) from UserJpaEntity u where u.id in :ids")
    List<UserIdentity> findIdentitiesByIdIn(@Param("ids") Collection<UUID> ids);

    @Query("select new com.example.iam.domain.model.UserIdentity(u.id, u.email) from UserJpaEntity u where lower(u.email) in :emails")
    List<UserIdentity> findIdentitiesByLowerEmailIn(@Param("emails") Collection<String> emails);
}
