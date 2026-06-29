package com.example.iam.application.usecase;

import com.example.iam.application.dto.RegisterCommand;
import com.example.iam.application.dto.RegisterResult;
import com.example.iam.application.dto.RegisteredUserResult;
import com.example.iam.domain.ErrorCodes;
import com.example.iam.domain.exception.DomainException;
import com.example.iam.domain.model.User;
import com.example.iam.domain.port.PasswordHasher;
import com.example.iam.domain.port.UserRepository;
import java.util.Locale;

public final class RegisterUseCase {
    private final UserRepository userRepository;
    private final PasswordHasher passwordHasher;

    public RegisterUseCase(
        UserRepository userRepository,
        PasswordHasher passwordHasher
    ) {
        this.userRepository = userRepository;
        this.passwordHasher = passwordHasher;
    }

    public RegisterResult execute(RegisterCommand command) {
        String email = normalizeEmail(command.email());
        if (userRepository.existsByEmail(email)) {
            throw emailAlreadyExists();
        }

        User user = User.register(email, passwordHasher.hash(command.password()));
        User saved = userRepository.save(user);

        return new RegisterResult(
            new RegisteredUserResult(
                saved.getId(),
                saved.getEmail(),
                saved.sortedRoles(),
                saved.getStatus().name(),
                saved.isEmailVerified()
            )
        );
    }

    private static DomainException emailAlreadyExists() {
        return new DomainException(
            ErrorCodes.EmailAlreadyExists,
            "Email already exists"
        );
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
