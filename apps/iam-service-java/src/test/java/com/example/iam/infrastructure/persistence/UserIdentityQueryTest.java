package com.example.iam.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.example.iam.domain.model.UserIdentity;
import com.example.iam.infrastructure.persistence.jpa.UserJpaEntity;
import com.example.iam.infrastructure.persistence.jpa.UserJpaRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

@DataJpaTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
class UserIdentityQueryTest {
    @Autowired UserJpaRepository repository;
    @Autowired TestEntityManager entities;

    @Test
    void findsIdentitiesByIdAndLowercaseEmailAndOmitsUnknownUsers() {
        var alice = entities.persistAndFlush(new UserJpaEntity("Alice@Example.test", "hash"));
        var bob = entities.persistAndFlush(new UserJpaEntity("bob@example.test", "hash"));
        entities.clear();

        assertEquals(
            List.of(new UserIdentity(alice.getId(), "alice@example.test")),
            repository.findIdentitiesByIdIn(List.of(alice.getId(), UUID.randomUUID()))
        );
        assertEquals(
            List.of(new UserIdentity(bob.getId(), "bob@example.test")),
            repository.findIdentitiesByLowerEmailIn(List.of("bob@example.test", "nobody@example.test"))
        );
    }
}
