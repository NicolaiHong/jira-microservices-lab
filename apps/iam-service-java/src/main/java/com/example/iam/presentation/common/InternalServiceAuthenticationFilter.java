package com.example.iam.presentation.common;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class InternalServiceAuthenticationFilter extends OncePerRequestFilter {
    private static final String SECRET_HEADER = "x-internal-service-secret";
    private final byte[] expectedSecret;

    public InternalServiceAuthenticationFilter(
        @Value("${INTERNAL_SERVICE_SECRET}") String internalServiceSecret
    ) {
        if (internalServiceSecret.isBlank()) {
            throw new IllegalArgumentException("INTERNAL_SERVICE_SECRET is required");
        }
        this.expectedSecret = internalServiceSecret.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getRequestURI().startsWith("/health");
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws IOException, ServletException {
        String header = request.getHeader(SECRET_HEADER);
        byte[] suppliedSecret = (header == null ? "" : header).getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(expectedSecret, suppliedSecret)) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Internal service authentication is required");
            return;
        }
        filterChain.doFilter(request, response);
    }
}
