# ADR 0003: Workspace Member Identity Lookup Through Project Service

## Status

Accepted — reflected in the implementation.

## Context

Workspace membership (`project_db`) stores only user IDs; account emails belong to IAM (`iam_db`). A person managing a workspace needs to see who its members are and to add a member by email, and an issue assignee needs to be chosen from those members. IAM has no knowledge of workspace membership, so it cannot decide on its own whether a caller may learn another account's email.

## Decision

- IAM exposes an internal `POST /internal/users/lookup` endpoint that accepts up to 100 user IDs and up to 100 emails and returns `{ items: [{ id, email }] }` for accounts that exist. It is protected by the internal service secret and is not routed by the Gateway.
- Project Service is the only caller. It authorizes first, then calls IAM once per request:
  - `GET /internal/workspaces/{id}/members` requires the caller to be a workspace member, lists memberships from `project_db`, and resolves their emails in one IAM call.
  - `POST /internal/workspaces/{id}/members` accepts exactly one of `userId` or `email`. For `email`, the member-manager and owner-role checks run before the IAM lookup; an unknown email returns `404 USER_NOT_FOUND`.
- Project Service forwards `x-correlation-id` and uses `HTTP_CLIENT_TIMEOUT_MS` for the IAM call. The Gateway routes `GET /api/workspaces/{id}/members` and rate-limits member additions per authenticated user.
- Emails are not copied into `project_db`.

## Alternatives

- Browser calls an IAM lookup through the Gateway. Rejected because IAM cannot tell whether the caller shares a workspace with the looked-up users, so any authenticated user could resolve any user ID to an email.
- Gateway composes Project members with IAM emails. Rejected because the authorization decision about who may see a member's email belongs to Project Service, and ADR 0001 keeps the Gateway thin.
- Store an email snapshot on each membership. Rejected because it duplicates IAM-owned data and drifts when accounts change.

## Consequences

Project Service gains a synchronous IAM dependency for member listing and email-based addition. When IAM is unavailable those two operations fail with `503 IAM_SERVICE_UNAVAILABLE`; membership changes by `userId`, project operations, and Issue access checks do not call IAM. A member whose user ID has no IAM account is listed with `email: null`.

A workspace `OWNER` or `ADMIN` can learn whether an email is registered by attempting to add it. The authorization-first ordering limits this to member managers, and the Gateway rate limit bounds the attempt rate.

## Failure semantics

IAM timeouts, transport errors, non-`2xx` responses, and malformed bodies are all `503 IAM_SERVICE_UNAVAILABLE`. No membership row is written when the lookup fails.
