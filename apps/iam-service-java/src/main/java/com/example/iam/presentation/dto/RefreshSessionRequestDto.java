package com.example.iam.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record RefreshSessionRequestDto(
    @NotBlank(message = "Refresh token is required")
    String refreshToken
) {}
