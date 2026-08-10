package com.example.iam.infrastructure.config;

import com.example.iam.application.usecase.LoginUseCase;
import com.example.iam.application.usecase.LogoutUseCase;
import com.example.iam.application.usecase.RefreshSessionUseCase;
import com.example.iam.application.usecase.RegisterUseCase;
import com.example.iam.domain.port.PasswordHasher;
import com.example.iam.domain.port.RefreshTokenRepository;
import com.example.iam.domain.port.TokenProvider;
import com.example.iam.domain.port.UserRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ApplicationConfig {
    @Bean
    public RegisterUseCase registerUseCase(
        UserRepository userRepository,
        PasswordHasher passwordHasher
    ) {
        return new RegisterUseCase(userRepository, passwordHasher);
    }

    @Bean
    public LoginUseCase loginUseCase(
        UserRepository userRepository,
        RefreshTokenRepository refreshTokenRepository,
        PasswordHasher passwordHasher,
        TokenProvider tokenProvider
    ) {
        return new LoginUseCase(
            userRepository,
            refreshTokenRepository,
            passwordHasher,
            tokenProvider
        );
    }

    @Bean
    public RefreshSessionUseCase refreshSessionUseCase(
        UserRepository userRepository,
        RefreshTokenRepository refreshTokenRepository,
        TokenProvider tokenProvider
    ) {
        return new RefreshSessionUseCase(
            userRepository,
            refreshTokenRepository,
            tokenProvider
        );
    }

    @Bean
    public LogoutUseCase logoutUseCase(
        RefreshTokenRepository refreshTokenRepository,
        TokenProvider tokenProvider
    ) {
        return new LogoutUseCase(refreshTokenRepository, tokenProvider);
    }
}
