# Authentication Feature

## Purpose

Account and session capability.

## Related Requirements

AUTH-001, AUTH-002.

## Related Business Flows

[Authentication](../flows/authentication.md).

## Responsibilities

IAM owns accounts/token lifecycle; Gateway owns public routing/cookies; web client owns access-token attachment and refresh retry.

## UI

`/login`, `/register`, `features/auth`.

## State

IAM users/refresh tokens; browser Zustand/localStorage session; HttpOnly refresh cookie.

## API Usage

See [authentication API](../api/authentication.md).

## Validation

Valid email; registration password length at least eight.

## Authorization

`/me` requires JWT; register/login are public.

## Error Handling

Gateway maps IAM errors; client retries a single 401 using refresh.

## Important Components / Modules

`iam-service-java`, Gateway `auth`, client `features/auth`.

## Tests

Client login form test and sparse service tests exist; broader coverage is a known limitation.

## Known Limitations

Access token is currently persisted in localStorage.

## Open Questions

Production token-storage policy.
