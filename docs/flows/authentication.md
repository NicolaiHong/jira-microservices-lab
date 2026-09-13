# Authentication Flow

## Purpose

Create an account and establish, refresh, or end an authenticated session.

## Actors

- Unauthenticated visitor
- Authenticated user

## Preconditions

IAM and Gateway are available; browser cookie support is enabled for refresh/logout.

## Trigger

Registration, login, token refresh, or logout.

## Main Flow

1. Visitor posts valid email/password to Gateway.
2. Gateway forwards to IAM with correlation ID and internal credential.
3. IAM normalizes identity and either registers or verifies credentials.
4. IAM issues an access token and a raw refresh token for login/refresh.
5. Gateway returns the access token/user and sets the refresh token as an HttpOnly cookie.
6. Browser attaches access token to later gateway calls; a 401 can trigger one refresh retry.

## Alternative Flows

### A1 — Refresh

Gateway reads the refresh cookie, IAM rotates a usable refresh token, and Gateway replaces the cookie.

### A2 — Logout

Gateway revokes the supplied cookie token if present and always clears the cookie.

## Failure / Error Flows

Invalid input, duplicate email, invalid credentials, blocked user, expired/invalid refresh token, missing cookie, or IAM unavailability return a mapped error.

## Business Rules

- [BR-AUTH-001](../product/business-rules.md#br-auth-001--normalized-unique-identities)
- [BR-AUTH-002](../product/business-rules.md#br-auth-002--session-safety)

## State Transitions

`active refresh token → revoked` during rotation/logout; rotation issues a replacement active token.

## Permissions

| Action | Visitor | Authenticated user |
| --- | --- | --- |
| Register/login | Yes | Yes |
| Refresh/logout | Cookie holder | Yes |
| `/api/auth/me` | No | Yes |

## Data Affected

User and refresh-token records in `iam_db`; browser session/localStorage and refresh cookie.

## API Dependencies

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## UI Entry Points

`/register`, `/login`, authentication store/interceptors.

## Validation

Email must be valid; register password is at least eight characters.

## Edge Cases

Refresh-token reuse after rotation fails; logout remains successful if the cookie is absent.

## Acceptance Criteria

### AC-AUTH-001

Given valid credentials, when a visitor logs in, then the gateway returns an access token and sets an HttpOnly refresh cookie.

## Related Documentation

[authentication API](../api/authentication.md), [security](../architecture/auth-and-security.md).
