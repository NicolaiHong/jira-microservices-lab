package com.example.iam.domain.port;

public interface PasswordHasher {
    String hash(String raw);

    boolean matches(String raw, String hashed);
}
