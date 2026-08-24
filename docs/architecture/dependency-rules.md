# Dependency Rules

## Purpose

Rules for safe evolution of the polyglot system.

1. Source dependencies and data ownership stay inside a service boundary; use HTTP contracts or versioned events between services.
2. Controllers/endpoints remain adapters: validate/translate/forward into application or domain use cases.
3. Gateway code must not accumulate domain state or business authorization that belongs to Project/Issue/IAM.
4. Use synchronous HTTP only where a current request requires an answer; use events for independent asynchronous projection.
5. Preserve `x-correlation-id`; never log passwords, bearer tokens, refresh tokens, or secrets.
6. A service must not query another service's database or import its implementation package.
7. New cross-service contract, persistence owner, or transport change requires an ADR.
