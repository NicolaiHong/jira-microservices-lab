package com.example.iam.application.dto;

public record LoginResult(
    String accessToken,
    String refreshToken,
    AuthenticatedUserResult user
) {}
