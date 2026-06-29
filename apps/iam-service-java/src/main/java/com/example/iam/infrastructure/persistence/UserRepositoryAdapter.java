package com.example.iam.infrastructure.persistence;

import com.example.iam.domain.ErrorCodes;
import com.example.iam.domain.exception.DomainException;
import com.example.iam.domain.model.User;
import com.example.iam.domain.port.UserRepository;
import com.example.iam.infrastructure.persistence.jpa.UserJpaEntity;
import com.example.iam.infrastructure.persistence.jpa.UserJpaRepository;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepositoryAdapter implements UserRepository {
    private final UserJpaRepository userJpaRepository;

    public UserRepositoryAdapter(UserJpaRepository userJpaRepository) {
        this.userJpaRepository = userJpaRepository;
    }

    @Override
    public Optional<User> findByEmail(String email) {
        return userJpaRepository.findByEmailIgnoreCase(email).map(this::toDomain);
    }

    @Override
    public boolean existsByEmail(String email) {
        return userJpaRepository.existsByEmailIgnoreCase(email);
    }

    @Override
    public User save(User user) {
        UserJpaEntity entity = new UserJpaEntity(
            user.getEmail(),
            user.getPasswordHash()
        );
        entity.setStatus(user.getStatus());
        entity.setEmailVerified(user.isEmailVerified());
        entity.replaceRoles(user.getRoles());

        try {
            return toDomain(userJpaRepository.saveAndFlush(entity));
        } catch (DataIntegrityViolationException exception) {
            throw new DomainException(
                ErrorCodes.EmailAlreadyExists,
                "Email already exists"
            );
        }
    }

    private User toDomain(UserJpaEntity entity) {
        return new User(
            entity.getId(),
            entity.getEmail(),
            entity.getPasswordHash(),
            entity.getStatus(),
            entity.isEmailVerified(),
            entity.getRoles()
        );
    }
}
