# Authentication API

## Purpose

Public authentication and session routes.

| Method/path | Auth | Purpose | Request | Success | Errors | Requirement |
| --- | --- | --- | --- | --- | --- | --- |
| `POST /api/auth/register` | No | Register account | `email`, `password` | `201 { user }` | validation, `EMAIL_ALREADY_EXISTS` | AUTH-001 |
| `POST /api/auth/login` | No | Start session | `email`, `password` | `200 { accessToken, user }` plus refresh cookie | invalid credentials, blocked, rate limit | AUTH-002 |
| `POST /api/auth/refresh` | Refresh cookie | Rotate session | no body | `200 { accessToken, user }` plus replacement cookie | `INVALID_REFRESH_TOKEN`, blocked | AUTH-002 |
| `POST /api/auth/logout` | Refresh cookie optional | End session | no body | `204`, clears cookie | IAM unavailable | AUTH-002 |
| `GET /api/auth/me` | Bearer | Get JWT identity | — | `200 { user }` | unauthorized/expired/invalid token | AUTH-002 |

Registration validates valid email and password length at least eight. Gateway intentionally strips raw refresh token from public login/refresh response.

Gateway rate limits registration (5 requests per 10 minutes per IP), login and refresh (10 requests per minute per IP). Login also limits failed attempts per normalized email. Rate limits use Fastify's resolved client IP, not an untrusted `x-forwarded-for` value. A rate-limited refresh returns `429 RATE_LIMITED` without clearing its refresh cookie.
