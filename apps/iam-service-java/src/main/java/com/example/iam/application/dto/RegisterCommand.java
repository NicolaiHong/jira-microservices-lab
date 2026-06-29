package com.example.iam.application.dto;

public record RegisterCommand(
    String email,
    String password
) {}
