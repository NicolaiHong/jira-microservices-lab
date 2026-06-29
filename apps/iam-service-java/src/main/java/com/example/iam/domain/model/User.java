package com.example.iam.domain.model;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public final class User {
    private final UUID id;
    private final String email;
    private final String passwordHash;
    private final UserStatus status;
    private final boolean emailVerified;
    private final Set<String> roles;

    public User(
        UUID id,
        String email,
        String passwordHash,
        UserStatus status,
        boolean emailVerified,
        Set<String> roles
    ) {
        this.id = id;
        this.email = email;
        this.passwordHash = passwordHash;
        this.status = status;
        this.emailVerified = emailVerified;
        this.roles = new LinkedHashSet<>(roles);
    }

    public static User register(String email, String passwordHash) {
        return new User(
            null,
            email,
            passwordHash,
            UserStatus.ACTIVE,
            false,
            Set.of("MEMBER")
        );
    }

    public UUID getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public UserStatus getStatus() {
        return status;
    }

    public boolean isEmailVerified() {
        return emailVerified;
    }

    public Set<String> getRoles() {
        return Set.copyOf(roles);
    }

    public List<String> sortedRoles() {
        return roles.stream().sorted().toList();
    }

    public boolean isBlocked() {
        return status == UserStatus.BLOCKED;
    }
}
