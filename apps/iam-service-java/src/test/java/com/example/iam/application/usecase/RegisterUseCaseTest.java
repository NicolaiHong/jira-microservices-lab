package com.example.iam.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.iam.application.dto.RegisterCommand;
import com.example.iam.domain.model.User;
import com.example.iam.domain.port.PasswordHasher;
import com.example.iam.domain.port.UserRepository;
import java.util.Locale;
import org.junit.jupiter.api.Test;

class RegisterUseCaseTest {
    @Test
    void emailNormalizationIsIndependentOfHostLocale() {
        Locale original = Locale.getDefault();
        try {
            Locale.setDefault(Locale.forLanguageTag("tr-TR"));
            UserRepository users = mock(UserRepository.class);
            when(users.save(any(User.class))).thenAnswer(call -> call.getArgument(0));
            var result = new RegisterUseCase(users, mock(PasswordHasher.class))
                .execute(new RegisterCommand("  IDENTITY@EXAMPLE.TEST  ", "password123"));
            assertEquals("identity@example.test", result.user().email());
        } finally {
            Locale.setDefault(original);
        }
    }
}
