package com.example.iam.presentation.exception;

import java.util.Map;

public record ApiErrorResponse(
    String code,
    String message,
    String correlationId,
    Map<String, Object> details
) {}
