package com.example.iam.presentation.common;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;

public final class CorrelationIdContext {
    public static final String HeaderName = "x-correlation-id";
    public static final String RequestAttribute =
        "com.example.iam.presentation.common.correlationId";

    private CorrelationIdContext() {}

    public static String resolve(HttpServletRequest request) {
        Object existing = request.getAttribute(RequestAttribute);
        if (existing instanceof String value) {
            return value;
        }

        String requested = request.getHeader(HeaderName);
        String value = requested == null || requested.isBlank()
            ? "req_" + UUID.randomUUID().toString().replace("-", "")
            : requested.trim();
        request.setAttribute(RequestAttribute, value);
        return value;
    }
}
