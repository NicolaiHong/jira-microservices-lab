package com.example.iam.presentation.dto;

public record LoginResponseDto(
    String accessToken,
    String refreshToken,
    AuthenticatedUserResponseDto user
) {}
