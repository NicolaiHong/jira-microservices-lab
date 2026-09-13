# Authentication and Security

## Purpose

Document verified authentication boundaries and security constraints.

- Gateway verifies HS256 JWTs using the configured secret, issuer, audience, and required `sub`, `email`, and roles claims.
- Gateway turns the authenticated subject into `x-authenticated-user-id` only on its internal calls; downstream services also require `x-internal-service-secret`.
- Login and refresh return the access token in the response; Gateway removes the refresh token from that body and places it in an HttpOnly, `SameSite=Strict` `/api/auth` cookie (secure in production).
- IAM stores password hashes and refresh-token hashes only. Refresh tokens rotate, and logout is safe to repeat.
- Private-service endpoint exposure relies on Compose internal networking plus the shared internal secret.
- The web client refreshes and replays an authenticated request once only when the Gateway rejected it with `401` before downstream business execution. This transport-level replay is distinct from a business mutation retry; Issue commands, including comments, disable React Query mutation retries after execution uncertainty.

**OPEN QUESTION:** The current web client persists the access token in localStorage. A production token-storage/cross-site strategy has not been decided; do not claim it is hardened beyond the present implementation.
