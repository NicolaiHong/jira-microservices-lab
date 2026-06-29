package com.example.iam.application.dto;

import java.util.List;
import java.util.UUID;

public record RegisteredUserResult(
    UUID id,
    String email,
    List<String> roles,
    String status,
    boolean emailVerified
) {}
