package com.example.iam.domain.port;

import com.example.iam.domain.model.User;
import com.example.iam.domain.model.UserIdentity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository {
    Optional<User> findByEmail(String email);

    Optional<User> findById(UUID id);

    List<UserIdentity> findIdentitiesByIds(Collection<UUID> ids);

    List<UserIdentity> findIdentitiesByEmails(Collection<String> normalizedEmails);

    boolean existsByEmail(String email);

    User save(User user);
}
