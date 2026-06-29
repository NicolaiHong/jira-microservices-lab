package com.example.iam.presentation.mapper;

import com.example.iam.application.dto.AuthenticatedUserResult;
import com.example.iam.application.dto.LoginCommand;
import com.example.iam.application.dto.LoginResult;
import com.example.iam.application.dto.RegisterCommand;
import com.example.iam.application.dto.RegisterResult;
import com.example.iam.application.dto.RegisteredUserResult;
import com.example.iam.presentation.dto.AuthenticatedUserResponseDto;
import com.example.iam.presentation.dto.LoginRequestDto;
import com.example.iam.presentation.dto.LoginResponseDto;
import com.example.iam.presentation.dto.RegisterRequestDto;
import com.example.iam.presentation.dto.RegisterResponseDto;
import com.example.iam.presentation.dto.RegisteredUserResponseDto;

public final class AuthDtoMapper {
    private AuthDtoMapper() {}

    public static RegisterCommand toCommand(RegisterRequestDto request) {
        return new RegisterCommand(request.email(), request.password());
    }

    public static LoginCommand toCommand(LoginRequestDto request) {
        return new LoginCommand(request.email(), request.password());
    }

    public static RegisterResponseDto toResponse(RegisterResult result) {
        return new RegisterResponseDto(toDto(result.user()));
    }

    public static LoginResponseDto toResponse(LoginResult result) {
        return new LoginResponseDto(
            result.accessToken(),
            result.refreshToken(),
            toDto(result.user())
        );
    }

    private static RegisteredUserResponseDto toDto(RegisteredUserResult user) {
        return new RegisteredUserResponseDto(
            user.id(),
            user.email(),
            user.roles(),
            user.status(),
            user.emailVerified()
        );
    }

    private static AuthenticatedUserResponseDto toDto(AuthenticatedUserResult user) {
        return new AuthenticatedUserResponseDto(
            user.id(),
            user.email(),
            user.roles()
        );
    }
}
