package com.example.iam.application.dto;

public record LoginCommand(
    String email,
    String password
) {}
