package com.example.iam.domain.model;

import java.util.UUID;

public record UserIdentity(UUID id, String email) {}
