package com.example.iam.auth.dto;

public record LoginResponse(
    String accessToken,
    String refreshToken,
    AuthenticatedUserResponse user
) {}
