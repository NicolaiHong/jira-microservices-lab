package com.example.iam.presentation.dto;

import java.util.List;
import java.util.UUID;

public record RegisteredUserResponseDto(
    UUID id,
    String email,
    List<String> roles,
    String status,
    boolean emailVerified
) {}
