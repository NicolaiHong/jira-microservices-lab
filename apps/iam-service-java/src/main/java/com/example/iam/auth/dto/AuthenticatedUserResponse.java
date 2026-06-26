package com.example.iam.auth.dto;

import java.util.List;
import java.util.UUID;

public record AuthenticatedUserResponse(
    UUID id,
    String email,
    List<String> roles
) {}
