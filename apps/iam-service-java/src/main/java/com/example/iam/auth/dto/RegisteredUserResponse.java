package com.example.iam.auth.dto;

import java.util.List;
import java.util.UUID;

public record RegisteredUserResponse(
    UUID id,
    String email,
    List<String> roles,
    String status,
    boolean emailVerified
) {}
