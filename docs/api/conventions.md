# API Conventions

## Purpose

Current cross-service HTTP conventions.

- Public browser routes are hosted by Gateway; internal services are addressed only by adapters.
- Protected routes require `Authorization: Bearer <accessToken>`.
- Gateway forwards `x-authenticated-user-id`, `x-correlation-id`, and internal service secret to downstream services; preserve correlation ID if supplied or generate one.
- JSON uses camelCase and successful resources are endpoint-specific rather than globally enveloped.
- Validated error responses use `{ code, message, correlationId, details }`; do not return stack traces or credentials.
- Current APIs are unversioned. A versioning decision is **OPEN QUESTION** before external stability is promised.
- There are no implemented query filter/pagination/sort parameters for issues or notifications.
