package com.example.iam.common.error;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiErrorResponse> handleApiException(
        ApiException exception,
        HttpServletRequest request
    ) {
        return build(
            exception.getStatus(),
            exception.getCode(),
            exception.getMessage(),
            exception.getDetails(),
            request
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(
        MethodArgumentNotValidException exception,
        HttpServletRequest request
    ) {
        Map<String, Object> details = new LinkedHashMap<>();
        for (FieldError error : exception.getBindingResult().getFieldErrors()) {
            details.put(error.getField(), error.getDefaultMessage());
        }

        return build(
            HttpStatus.BAD_REQUEST,
            "VALIDATION_ERROR",
            "Request validation failed",
            details,
            request
        );
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleConstraintViolation(
        ConstraintViolationException exception,
        HttpServletRequest request
    ) {
        return build(
            HttpStatus.BAD_REQUEST,
            "VALIDATION_ERROR",
            "Request validation failed",
            Map.of("validation", exception.getMessage()),
            request
        );
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleDataIntegrity(
        DataIntegrityViolationException exception,
        HttpServletRequest request
    ) {
        if (exception.getMostSpecificCause().getMessage().contains("users_email_lower_idx")) {
            return build(
                HttpStatus.CONFLICT,
                "EMAIL_ALREADY_EXISTS",
                "Email already exists",
                Map.of(),
                request
            );
        }

        return build(
            HttpStatus.BAD_REQUEST,
            "VALIDATION_ERROR",
            "Request validation failed",
            Map.of(),
            request
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(
        Exception exception,
        HttpServletRequest request
    ) {
        return build(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "Unexpected server error",
            Map.of(),
            request
        );
    }

    private ResponseEntity<ApiErrorResponse> build(
        HttpStatus status,
        String code,
        String message,
        Map<String, Object> details,
        HttpServletRequest request
    ) {
        return ResponseEntity
            .status(status)
            .body(new ApiErrorResponse(code, message, correlationId(request), details));
    }

    private String correlationId(HttpServletRequest request) {
        String value = request.getHeader("X-Correlation-Id");
        if (value != null && !value.isBlank()) {
            return value;
        }

        return "req_" + UUID.randomUUID().toString().replace("-", "");
    }
}
