package com.example.iam.auth;

import com.example.iam.auth.dto.AuthenticatedUserResponse;
import com.example.iam.auth.dto.LoginRequest;
import com.example.iam.auth.dto.LoginResponse;
import com.example.iam.auth.dto.RegisterRequest;
import com.example.iam.auth.dto.RegisterResponse;
import com.example.iam.auth.dto.RegisteredUserResponse;
import com.example.iam.common.error.ApiException;
import com.example.iam.security.JwtTokenService;
import com.example.iam.token.RefreshTokenEntity;
import com.example.iam.token.RefreshTokenRepository;
import com.example.iam.token.RefreshTokenService;
import com.example.iam.user.UserEntity;
import com.example.iam.user.UserRepository;
import com.example.iam.user.UserStatus;
import java.util.List;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final RefreshTokenService refreshTokenService;

    public AuthService(
        UserRepository userRepository,
        RefreshTokenRepository refreshTokenRepository,
        PasswordEncoder passwordEncoder,
        JwtTokenService jwtTokenService,
        RefreshTokenService refreshTokenService
    ) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        this.refreshTokenService = refreshTokenService;
    }

    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ApiException(
                HttpStatus.CONFLICT,
                "EMAIL_ALREADY_EXISTS",
                "Email already exists"
            );
        }

        UserEntity user = new UserEntity(email, passwordEncoder.encode(request.password()));

        try {
            UserEntity saved = userRepository.saveAndFlush(user);
            return new RegisterResponse(toRegisteredUserResponse(saved));
        } catch (DataIntegrityViolationException exception) {
            throw new ApiException(
                HttpStatus.CONFLICT,
                "EMAIL_ALREADY_EXISTS",
                "Email already exists"
            );
        }
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        UserEntity user = userRepository
            .findByEmailIgnoreCase(email)
            .orElseThrow(this::invalidCredentials);

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw invalidCredentials();
        }

        if (user.getStatus() == UserStatus.BLOCKED) {
            throw new ApiException(HttpStatus.FORBIDDEN, "USER_BLOCKED", "User is blocked");
        }

        String accessToken = jwtTokenService.issueAccessToken(user);
        String refreshToken = refreshTokenService.generateOpaqueToken();
        refreshTokenRepository.save(
            new RefreshTokenEntity(
                user,
                refreshTokenService.hashToken(refreshToken),
                refreshTokenService.expiresAt()
            )
        );

        return new LoginResponse(accessToken, refreshToken, toAuthenticatedUserResponse(user));
    }

    private ApiException invalidCredentials() {
        return new ApiException(
            HttpStatus.UNAUTHORIZED,
            "INVALID_CREDENTIALS",
            "Email or password is invalid"
        );
    }

    private RegisteredUserResponse toRegisteredUserResponse(UserEntity user) {
        return new RegisteredUserResponse(
            user.getId(),
            user.getEmail(),
            sortedRoles(user),
            user.getStatus().name(),
            user.isEmailVerified()
        );
    }

    private AuthenticatedUserResponse toAuthenticatedUserResponse(UserEntity user) {
        return new AuthenticatedUserResponse(user.getId(), user.getEmail(), sortedRoles(user));
    }

    private List<String> sortedRoles(UserEntity user) {
        return user.getRoles().stream().sorted().toList();
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
