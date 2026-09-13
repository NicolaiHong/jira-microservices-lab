# Coding Standards

## Purpose

Cross-language standards derived from the current architecture.

- Keep route handlers/controllers thin; place use-case orchestration and domain rules behind them.
- Use explicit request/response DTOs; do not return persistence entities or secrets.
- Validate at service boundaries and return a stable error `code`, `message`, `details`, and `correlationId` shape where implemented.
- Use domain terms (`workspace`, `issue`, `sprint`) rather than framework-centric modules as the organizing vocabulary.
- No direct browser-to-service calls; browser API clients call the gateway.
- Avoid speculative abstractions and cross-service shared domain libraries.
