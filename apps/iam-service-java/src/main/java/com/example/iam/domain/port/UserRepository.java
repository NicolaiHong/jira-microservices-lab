package com.example.iam.domain.port;

import com.example.iam.domain.model.User;
import java.util.Optional;

public interface UserRepository {
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    User save(User user);
}
