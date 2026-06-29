package com.example.iam.presentation.exception;

import com.example.iam.domain.ErrorCodes;
import com.example.iam.domain.exception.DomainException;
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
public class ApiExceptionHandler {
    @ExceptionHandler(DomainException.class)
    public ResponseEntity<ApiErrorResponse> handleDomainException(
        DomainException exception,
        HttpServletRequest request
    ) {
        return build(
            statusFor(exception.getErrorCode()),
            exception.getErrorCode(),
            exception.getMessage(),
            Map.of(),
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
            ErrorCodes.ValidationError,
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
            ErrorCodes.ValidationError,
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
                ErrorCodes.EmailAlreadyExists,
                "Email already exists",
                Map.of(),
                request
            );
        }

        return build(
            HttpStatus.BAD_REQUEST,
            ErrorCodes.ValidationError,
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
            ErrorCodes.InternalError,
            "Unexpected server error",
            Map.of(),
            request
        );
    }

    private HttpStatus statusFor(String errorCode) {
        return switch (errorCode) {
            case ErrorCodes.EmailAlreadyExists -> HttpStatus.CONFLICT;
            case ErrorCodes.InvalidCredentials -> HttpStatus.UNAUTHORIZED;
            case ErrorCodes.UserBlocked -> HttpStatus.FORBIDDEN;
            default -> HttpStatus.BAD_REQUEST;
        };
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
