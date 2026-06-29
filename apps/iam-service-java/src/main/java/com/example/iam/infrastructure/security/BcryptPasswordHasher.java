package com.example.iam.infrastructure.security;

import com.example.iam.domain.port.PasswordHasher;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class BcryptPasswordHasher implements PasswordHasher {
    private final PasswordEncoder passwordEncoder;

    public BcryptPasswordHasher(PasswordEncoder passwordEncoder) {
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public String hash(String raw) {
        return passwordEncoder.encode(raw);
    }

    @Override
    public boolean matches(String raw, String hashed) {
        return passwordEncoder.matches(raw, hashed);
    }
}
