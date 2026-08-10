package com.example.iam.presentation.controller;

import com.example.iam.application.usecase.LoginUseCase;
import com.example.iam.application.usecase.LogoutUseCase;
import com.example.iam.application.usecase.RegisterUseCase;
import com.example.iam.application.usecase.RefreshSessionUseCase;
import com.example.iam.presentation.dto.LoginRequestDto;
import com.example.iam.presentation.dto.LoginResponseDto;
import com.example.iam.presentation.dto.LogoutRequestDto;
import com.example.iam.presentation.dto.RegisterRequestDto;
import com.example.iam.presentation.dto.RegisterResponseDto;
import com.example.iam.presentation.dto.RefreshSessionRequestDto;
import com.example.iam.presentation.mapper.AuthDtoMapper;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {
    private final RegisterUseCase registerUseCase;
    private final LoginUseCase loginUseCase;
    private final RefreshSessionUseCase refreshSessionUseCase;
    private final LogoutUseCase logoutUseCase;

    public AuthController(
        RegisterUseCase registerUseCase,
        LoginUseCase loginUseCase,
        RefreshSessionUseCase refreshSessionUseCase,
        LogoutUseCase logoutUseCase
    ) {
        this.registerUseCase = registerUseCase;
        this.loginUseCase = loginUseCase;
        this.refreshSessionUseCase = refreshSessionUseCase;
        this.logoutUseCase = logoutUseCase;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public RegisterResponseDto register(@Valid @RequestBody RegisterRequestDto request) {
        return AuthDtoMapper.toResponse(
            registerUseCase.execute(AuthDtoMapper.toCommand(request))
        );
    }

    @PostMapping("/login")
    public LoginResponseDto login(@Valid @RequestBody LoginRequestDto request) {
        return AuthDtoMapper.toResponse(
            loginUseCase.execute(AuthDtoMapper.toCommand(request))
        );
    }

    @PostMapping("/refresh")
    public LoginResponseDto refresh(
        @Valid @RequestBody RefreshSessionRequestDto request
    ) {
        return AuthDtoMapper.toResponse(
            refreshSessionUseCase.execute(AuthDtoMapper.toCommand(request))
        );
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Valid @RequestBody LogoutRequestDto request) {
        logoutUseCase.execute(AuthDtoMapper.toCommand(request));
    }
}
