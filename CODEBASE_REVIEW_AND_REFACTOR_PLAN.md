# Codebase Review and Refactor Plan

> **Audience**: AI Coding Agent (OpenAI Codex / similar).
> **Rule**: Do NOT invent new business rules or expand scope beyond what is documented. Follow `AGENTS.md` boundaries at all times.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Critical Bugs and Correctness Issues](#2-critical-bugs-and-correctness-issues)
3. [Security Findings](#3-security-findings)
4. [API Contract and Cross-Service Consistency](#4-api-contract-and-cross-service-consistency)
5. [Architecture and Design Issues](#5-architecture-and-design-issues)
6. [Data Layer and Database Issues](#6-data-layer-and-database-issues)
7. [Error Handling and Observability](#7-error-handling-and-observability)
8. [Testing Gaps](#8-testing-gaps)
9. [Build, CI, and Configuration Issues](#9-build-ci-and-configuration-issues)
10. [Frontend (Web Client) Issues](#10-frontend-web-client-issues)
11. [Code Quality and Maintainability](#11-code-quality-and-maintainability)

---

## 1. System Overview

| Service | Stack | Purpose |
|---------|-------|---------|
| `apps/api-gateway-nest` | NestJS/Fastify | Edge gateway: JWT validation, routing, correlation propagation |
| `apps/iam-service-java` | Spring Boot (Java 17) | Users, passwords, JWT issuance, refresh-token sessions |
| `apps/project-service-dotnet` | ASP.NET Core (.NET 9) | Workspaces, membership, projects, lifecycle |
| `apps/issue-service-nest` | NestJS/Fastify | Issues, comments, history, planning, transactional outbox |
| `apps/notification-service-go` | Go 1.22 | Kafka consumer, Redis notification projection |
| `apps/web-client` | Next.js 16 / React 19 | Browser client (calls Gateway only) |

Communication: Synchronous HTTP for request-time checks; Kafka (`issue.events.v1`) for notification propagation via Transactional Outbox.

---

## 2. Critical Bugs and Correctness Issues

### 2.1 — `DONE` to `IN_PROGRESS` transition allowed by domain model but may violate business rules

**Implementation (2026-09-05):** [ ] **Intentionally skipped** — BR-STATUS-001 explicitly permits DONE -> IN_PROGRESS; working as designed.

- **File**: `apps/issue-service-nest/src/domain/issue.ts`
- **Lines**: Transition map at `validTransitions`
- **Problem**: The domain allows `DONE → IN_PROGRESS` (re-open). The frontend `Board.tsx` (`validMoves`) also allows `DONE → left → IN_PROGRESS`. However, the documented flow in `docs/product/business-rules.md` should be checked to confirm whether re-opening is an intended feature.
- **Action**: Verify the documented business rules. If re-open is NOT intended, remove `DONE → IN_PROGRESS` from both `issue.ts` and `Board.tsx`. If it IS intended, this is working as designed.

### 2.2 — `MarkAllRead` is O(N) sequential calls, not pipelined

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `apps/notification-service-go/internal/store/redis_store.go`
- **Lines**: 110-121
- **Problem**: `MarkAllRead` fetches all notification IDs and calls `MarkRead` one at a time in a loop. For users with many notifications, this is unnecessarily slow and not atomic.
- **Action**: Rewrite `MarkAllRead` to use a single Redis pipeline (`TxPipeline`) that sets `readAt` on all notification hashes in one round-trip.

### 2.3 — Hardcoded breadcrumb "Orbit Launch" on board page

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `apps/web-client/src/app/(dashboard)/projects/[projectId]/board/page.tsx`
- **Line**: 16
- **Problem**: The breadcrumb text `"Projects / Orbit Launch"` is hardcoded instead of using the actual project name from `projectQuery.data?.name`.
- **Action**: Replace the hardcoded string with dynamic project name: `Projects / {projectQuery.data?.name ?? "..."}`.

### 2.4 — Board avatar initials hardcoded to "AM"

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `apps/web-client/src/features/issue/components/Board/Board.tsx`
- **Lines**: 227-229
- **Problem**: Every issue card renders a hardcoded avatar `"AM"` instead of deriving initials from the actual assignee.
- **Action**: Derive initials from assignee user data or render a generic user icon when assignee info is unavailable.

### 2.5 — `useIssue` and `useIssues` share the same query key prefix

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `apps/web-client/src/features/issue/hooks/useIssue.ts` and `useIssues.ts`
- **Problem**: `useIssue(issueId)` uses `queryKey: ["issues", issueId]` and `useIssues(projectId)` uses `queryKey: ["issues", projectId]`. Since both `issueId` and `projectId` are UUIDs, there is no structural ambiguity, but cache invalidation calls like `queryClient.invalidateQueries({ queryKey: ["issues", projectId] })` could accidentally invalidate `useIssue` data (or vice versa) if the query matcher is prefix-based.
- **Action**: Differentiate query keys: e.g. `["issue", issueId]` vs `["issues", "list", projectId]`. Update all corresponding `invalidateQueries` calls.

---

## 3. Security Findings

### 3.1 — JWT access token stored in `localStorage`

**Implementation (2026-09-05):** [ ] **Intentionally skipped** — Memory-only token storage remains an open product/security policy decision; minimum risk documentation was added.

- **File**: `apps/web-client/src/features/auth/store.ts`
- **Lines**: 57-71
- **Problem**: The access token is persisted in `localStorage`, which is accessible to any JavaScript running on the page (XSS vulnerable). Refresh tokens should be stored in HTTP-only cookies (the IAM service issues them, and the interceptor sends `withCredentials: true`, suggesting cookie-based refresh is partially intended), but the access token itself should NOT be in `localStorage` in a production system.
- **Risk**: Medium. The Gateway already validates JWTs on every request, so the blast radius is limited to the token's TTL.
- **Action**: Consider moving access token storage to an in-memory-only Zustand store (no `localStorage` persistence) and rely on the refresh token (sent via HTTP-only cookie) to re-obtain the access token on page load. At minimum, add a comment documenting the risk.

### 3.2 — Logout does not send refresh token for server-side revocation

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `apps/web-client/src/features/auth/api.ts` line 15-17
- **Problem**: The frontend's `logout()` calls `POST /api/auth/logout` with no body. However, the IAM's `AuthController.logout()` expects a `LogoutRequestDto` containing the `refreshToken`. The Gateway's `AuthController` also passes the body through. Without the refresh token, the server cannot revoke the session — the logout is client-only.
- **Action**: Send the stored refresh token in the logout request body. If the token is in an HTTP-only cookie, the Gateway needs to extract and forward it.

### 3.3 — No rate limiting on auth endpoints

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `apps/api-gateway-nest/src/main.ts` and `apps/iam-service-java`
- **Problem**: `/api/auth/login`, `/api/auth/register`, and `/api/auth/refresh` have no rate limiting. This leaves the system vulnerable to brute-force and credential-stuffing attacks.
- **Action**: Add a rate-limiting guard (e.g., `@nestjs/throttler`) on the Gateway's auth routes.

### 3.4 — `x-authenticated-user-id` header trust boundary

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **Files**: Issue Service `request-context.ts`, Project Service `AuthContext.cs`, Notification Service `handler.go`
- **Problem**: All internal services trust `x-authenticated-user-id` from the header. This is correct IF the internal secret guard is the sole perimeter, but if any service is accidentally exposed without the guard, identity injection is possible.
- **Action**: No code change required; this is documented architecture. Add a comment in each service noting the trust boundary dependency on the internal secret guard.

---

## 4. API Contract and Cross-Service Consistency

### 4.1 — `getProject` frontend expects flat response but other endpoints wrap in `{ project: ... }`

**Implementation (2026-09-05):** [ ] **Intentionally skipped** — Flat GET response is intentional in the documented API contract.

- **File**: `apps/web-client/src/features/project/api.ts` line 43-46
- **Problem**: `getProject` does `http.get<Project>(...)` expecting a flat `Project` shape. The Project Service's `GetProjectUseCase` returns `ProjectResult` which is mapped to a flat `ProjectResponse`. The Gateway proxy passes this through verbatim. **Currently working correctly**, but inconsistent with other project endpoints which wrap in `{ project: ... }`.
- **Action**: For consistency, wrap the `GetProjectUseCase` result in `{ project: ... }` like `CreateProjectResponse` does, and update the frontend to `data.project`. Alternatively, document this as intentional.

### 4.2 — Refresh endpoint body mismatch

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `apps/web-client/src/lib/interceptors.ts` lines 22-27
- **Problem**: The interceptor calls `POST /api/auth/refresh` with `undefined` body. The IAM's `RefreshSessionUseCase` requires a `refreshToken` in the body. If the refresh token is sent via HTTP-only cookie, the Gateway auth controller must extract it from the cookie and include it in the forwarded request body. The Gateway's `auth.controller.ts` does handle this (forwards body from request). However, the frontend sends `undefined` — this will fail unless cookies carry the token AND the Gateway extracts/forwards it.
- **Action**: Verify the complete refresh flow end-to-end. If the refresh token is stored client-side, the interceptor must include it in the request body.

### 4.3 — Event payload `recipientUserIds` population audit

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `apps/issue-service-nest/src/infrastructure/postgres-issue.repository.ts`
- **Problem**: The outbox events include `recipientUserIds` in the payload. For `issue.created`, recipients include the assignee. For `issue.assigned`, recipients include old and new assignees. For `issue.updated`, the code includes both reporter and assignee. Verify that `issue.transitioned` and `issue.commented` also correctly populate recipients per the event schema contract (`contracts/events/issue-event-v1.schema.json`).
- **Action**: Audit each outbox event insertion in `postgres-issue.repository.ts` to ensure `recipientUserIds` is correctly populated for all five event types.

### 4.4 — `ProjectAccessContextResult` field name casing dependency

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **Files**: Issue Service `ports.ts` (`ProjectAccessContext` interface) vs. Project Service `ProjectDtos.cs` (`ProjectAccessContextResponse`)
- **Issue Service expects**: `projectId`, `workspaceId`, `projectKey`, `projectStatus`, `membershipRole`
- **Project Service returns**: PascalCase records, but ASP.NET Core defaults to `camelCase` JSON serialization.
- **Problem**: This currently works because of the default serializer config. However, this depends on the default not being changed.
- **Action**: No change needed, but add a contract test or JSON schema validation to prevent regressions.

---

## 5. Architecture and Design Issues

### 5.1 — WebSocket notification path has no server-side implementation

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **Files**: `apps/web-client/src/lib/socketClient.ts`, `apps/web-client/src/features/notification/socket.ts`
- **Problem**: The frontend has a WebSocket client that connects to `ws://localhost:4000` for real-time notification push. However, there is NO WebSocket server implementation in any backend service. The notification service is HTTP+Kafka only.
- **Action**: Either (a) implement a WebSocket server (likely in the Gateway or a dedicated push service), or (b) remove the dead WebSocket client code and use polling via the existing REST notification endpoints, or (c) document this as a planned future feature and add a `TODO` comment.

### 5.2 — Outbox Publisher sends events one-at-a-time, not in batch

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `apps/issue-service-nest/src/infrastructure/outbox.publisher.ts`
- **Lines**: 57-88
- **Problem**: The publisher fetches up to 50 pending events but sends each as an individual Kafka `producer.send()` call inside a `for` loop. This is inefficient — KafkaJS supports sending multiple messages in a single `send()` call.
- **Action**: Batch messages and send them in a single `producer.send()` with multiple messages, then mark all as published. Alternatively, if ordering per aggregate is critical, batch by `aggregateId`.

### 5.3 — `useIssueStore` Zustand store is unused in practice

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `apps/web-client/src/features/issue/store.ts`
- **Problem**: The `useIssueStore` defines `statusFilter` and `priorityFilter` state, but the `Board.tsx` component uses its own local `useState` for these. The Zustand store is dead code.
- **Action**: Either integrate the Zustand store into `Board.tsx` (replacing local state), or delete the unused store.

### 5.4 — Notification consumer makes one HTTP call per recipient per event

**Implementation (2026-09-05):** [ ] **Intentionally skipped** — Optional N+1 optimization deferred; current payloads have at most two recipients and sequential checks preserve all-checks-before-write behavior.

- **File**: `apps/notification-service-go/internal/consumer/issue_events.go` lines 217-231
- **Problem**: For each recipient in an event, the consumer calls `accessChecker.CheckAccess()` — an HTTP call to the Project Service. For events with many recipients, this creates N sequential HTTP round-trips per event.
- **Action**: Consider adding a batch access check endpoint to the Project Service, or parallelize the checks using goroutines with bounded concurrency.

---

## 6. Data Layer and Database Issues

### 6.1 — Issue Service SQL migrations may lack automated runner

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **Files**: `apps/issue-service-nest/migrations/001_init.sql`, `002_archiving.sql`, `003_planning.sql`
- **Problem**: The migration files exist as raw SQL but there is no visible migration runner configured in the Issue Service codebase (no Flyway, Knex migrations, or custom runner). The `app.module.ts` does not reference these files. They appear to be manually applied or applied by Docker entrypoint.
- **Action**: Verify how migrations are applied (check Dockerfile or docker-compose init scripts). If they are manually applied, add an automated migration runner to `onModuleInit` or a startup script.

### 6.2 — IAM `refresh_tokens` table has no cleanup for expired tokens

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `apps/iam-service-java/src/main/resources/db/migration/V1__create_iam_auth_tables.sql`
- **Problem**: Expired and revoked refresh tokens accumulate indefinitely. There is no scheduled job or database trigger to clean them up.
- **Action**: Add a scheduled task (e.g., `@Scheduled` in Spring) to periodically delete tokens where `expires_at < NOW()` or `revoked = TRUE`.

### 6.3 — `AddWorkspaceMemberUseCase` uses raw `DateTimeOffset.UtcNow` instead of `PostgresTimestamp.UtcNow()`

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `apps/project-service-dotnet/Application/UseCases/AddWorkspaceMemberUseCase.cs` line 39
- **Problem**: `DateTimeOffset.UtcNow` has nanosecond-level precision which PostgreSQL truncates to microseconds. Other use cases use `PostgresTimestamp.UtcNow()` which truncates proactively.
- **Action**: Use `PostgresTimestamp.UtcNow()` consistently in all use cases.

---

## 7. Error Handling and Observability

### 7.1 — Issue Service logs request details but not error details

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `apps/issue-service-nest/src/main.ts` lines 54-67
- **Problem**: The `onResponse` hook logs method, path, status, and duration, but does NOT include error information. When a 500 occurs, the log entry shows `status: 500` but the error message/stack is lost.
- **Action**: Add error logging in the `DomainExceptionFilter` or in a Fastify `onError` hook to capture and log error details.

### 7.2 — Notification service `correlationId` fallback uses timestamp, not UUID

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `apps/notification-service-go/internal/api/handler.go` line 121
- **Problem**: When no correlation ID is provided, the fallback is a timestamp-based string. All other services use UUIDs for correlation IDs.
- **Action**: Use `uuid.New().String()` (from `github.com/google/uuid`) instead of the timestamp-based fallback, for consistency and to avoid collisions.

### 7.3 — `DomainError` in Issue Service does not set `Error.name`

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `apps/issue-service-nest/src/domain/errors.ts`
- **Problem**: The `DomainError` class extends `Error` but does not set `this.name = 'DomainError'`. Stack traces will show `Error:` instead of `DomainError:`.
- **Action**: Add `this.name = 'DomainError';` to the constructor.

---

## 8. Testing Gaps

### 8.1 — IAM Service: Tests skipped in CI

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `.github/workflows/ci.yml` line 79
- **Problem**: The Java CI job runs `mvn -B package -Dmaven.test.skip=true`, explicitly skipping all tests. The only IAM test (`RefreshSessionUseCaseTest.java`) is never run in CI.
- **Action**: Change to `mvn -B verify` (or `mvn -B test`) to run tests. If tests are failing, fix them.

### 8.2 — No unit tests for Gateway service layer

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **Files**: `apps/api-gateway-nest/src/services/*.ts`
- **Problem**: The Gateway's `ProjectsService`, `IssuesService`, `NotificationsService`, and `AuthService` have no unit tests. The Gateway is a critical routing layer.
- **Action**: Add unit tests for the Gateway's service classes, particularly for error translation and request forwarding logic.

### 8.3 — No integration tests for the notification consumer

**Implementation (2026-09-05):** [ ] **Intentionally skipped** — Optional Kafka/testcontainers suite deferred; real Redis regression and complete Kafka/consumer/Redis smoke flow passed.

- **File**: `apps/notification-service-go/internal/consumer/issue_events_test.go`
- **Problem**: The consumer tests exist as unit tests with mock interfaces, which is good. However, there are no integration tests with a real Redis instance or Kafka broker.
- **Action**: Consider adding integration tests that run against actual Redis (using testcontainers or the CI Compose stack).

### 8.4 — Frontend tests don't cover the refresh token interceptor

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `apps/web-client/src/lib/interceptors.test.ts`
- **Problem**: Verify that the interceptor test covers the 401 -> refresh -> retry flow and the concurrent-refresh deduplication logic.
- **Action**: Review existing tests; add coverage for the refresh-and-retry happy path and the double-401 (refresh fails) path.

---

## 9. Build, CI, and Configuration Issues

### 9.1 — Docker Compose secret management

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `infra/docker-compose/docker-compose.yml`
- **Problem**: The `INTERNAL_SERVICE_SECRET` is set in the environment block. Verify that the Compose file does not commit a production-grade secret.
- **Action**: Use `${INTERNAL_SERVICE_SECRET:?Required}` syntax in Compose to force external secret injection. Add a `.env.example` documenting the required variables.

### 9.2 — `npm audit` runs in CI but severity threshold is not configured

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `.github/workflows/ci.yml` line 25
- **Problem**: `npm audit --omit=dev` is run but its exit code behavior may not block the build depending on severity thresholds.
- **Action**: Add `--audit-level=high` or `--audit-level=critical` to control the severity threshold that should fail the build.

### 9.3 — Go version in CI (1.22) may drift from go.mod

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `.github/workflows/ci.yml` line 124
- **Problem**: The CI pins Go 1.22, but the `go.mod` file may specify a different version.
- **Action**: Verify `go.mod` specifies `go 1.22` or later. Consider reading the Go version from `go.mod` in CI.

### 9.4 — .NET CI job only builds, does not run unit tests

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `.github/workflows/ci.yml` line 88
- **Problem**: The `dotnet` job runs `dotnet build` only. The `project-access-postgres` job runs integration tests, but the unit tests in `ProjectDomainTests.cs` and `ProjectUseCaseTests.cs` are only run as part of integration (requires Postgres).
- **Action**: Add a separate `dotnet test` step that runs unit tests without requiring a database.

---

## 10. Frontend (Web Client) Issues

### 10.1 — `IssueDetailModal` uses `defaultValue` which doesn't update on re-fetch

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `apps/web-client/src/features/issue/components/IssueDetailModal/IssueDetailModal.tsx`
- **Lines**: 178-182
- **Problem**: The edit form uses `defaultValue={issue.summary}` on uncontrolled inputs. After a concurrent modification error, the form re-fetches the issue data (`invalidateQueries`), but `defaultValue` does NOT update on re-render — React uncontrolled inputs only use `defaultValue` on mount.
- **Action**: Either (a) use controlled inputs (`value` + `onChange`) that update when `issue` changes, or (b) add a `key={issue.version}` to the form to force remount when the issue version changes.

### 10.2 — No loading/error states for many queries

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **Files**: Multiple page components (`board/page.tsx`, `backlog/page.tsx`, `roadmap/page.tsx`)
- **Problem**: Most pages check `isPending` but don't display error states when queries fail. If the API returns an error, the user sees nothing or a stale state.
- **Action**: Add `isError` handling to display error messages and retry buttons.

### 10.3 — `IssueForm` component integration verification needed

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `apps/web-client/src/features/issue/components/IssueForm/IssueForm.tsx`
- **Problem**: The `IssueForm` component exists but its integration with the Board's `onCreateIssue` callback should be verified. If the Board opens a dialog/modal for issue creation, the form should be used there.
- **Action**: Verify the create-issue flow end-to-end from the Board's "Create issue" button.

### 10.4 — `socketClient` is a singleton with no reconnection logic

**Implementation (2026-09-05):** [ ] **Intentionally skipped** — WebSocket client removed under 5.1 because no server contract exists; documented polling remains.

- **File**: `apps/web-client/src/lib/socketClient.ts`
- **Problem**: The `SocketClient` class has no reconnection logic, no heartbeat, and no error handling for connection drops. Even when the WebSocket server exists, the client will silently lose connection.
- **Action**: Add automatic reconnection with exponential backoff, connection state tracking, and an `onerror`/`onclose` handler.

### 10.5 — Missing page titles and SEO metadata

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **Files**: All page components under `apps/web-client/src/app/`
- **Problem**: None of the pages set `<title>` or metadata using Next.js 16's metadata API.
- **Action**: Add `metadata` exports or `<title>` elements to each page for proper browser tab titles.

---

## 11. Code Quality and Maintainability

### 11.1 — Gateway adapter classes duplicate HTTP client boilerplate

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **Files**: `apps/api-gateway-nest/src/infrastructure/http-clients/project-service.adapter.ts`, `issue-service.adapter.ts`, `notifications-service.adapter.ts`, `auth-service.adapter.ts`
- **Problem**: Each adapter reimplements the same `fetch` + timeout + error-translation pattern. This violates DRY and makes it easy for error handling to diverge.
- **Action**: Extract a shared `InternalServiceHttpClient` class that handles the fetch, timeout, correlation propagation, error translation, and logging. Each adapter becomes a thin wrapper calling `this.client.forward(method, path, body, context)`.

### 11.2 — Issue Service controller accepts `body: unknown` without DTO validation

**Implementation (2026-09-05):** [ ] **Intentionally skipped** — Application-layer validation is intentional; no speculative DTO/OpenAPI refactor.

- **File**: `apps/issue-service-nest/src/presentation/issues.controller.ts`
- **Problem**: All endpoints accept `@Body() body: unknown`. Validation happens inside the application service, which is fine for hexagonal architecture, but there are no NestJS DTOs for request shape validation.
- **Action**: This is a design choice (validation in application layer). No change required, but consider adding NestJS DTOs with class-validator for automatic OpenAPI schema generation.

### 11.3 — IAM Service may need explicit Spring Security config

**Implementation (2026-09-05):** [ ] **Intentionally skipped** — Only spring-security-crypto is present; no Spring web Security filter chain is activated.

- **File**: `apps/iam-service-java/src/main/java/com/example/iam/infrastructure/config/`
- **Problem**: The `InternalServiceAuthenticationFilter` extends `OncePerRequestFilter` and is registered as a `@Component`. If Spring Security IS on the classpath, auto-configuration may add default CSRF protection, form login, etc.
- **Action**: Verify the `pom.xml` dependencies. If Spring Security is present, add an explicit `SecurityFilterChain` bean that disables CSRF, disables form login, and registers the internal service filter.

### 11.4 — Duplicate email normalization logic in IAM

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **Files**: `RegisterUseCase.java` (line 52), `LoginUseCase.java` (line 76)
- **Problem**: Both use cases have their own `normalizeEmail` method with identical logic (`email.trim().toLowerCase(Locale.ROOT)`).
- **Action**: Extract to a shared utility method (e.g., `EmailNormalizer.normalize()`).

### 11.5 — `@dnd-kit/core` and `@dnd-kit/sortable` are unused dependencies

**Implementation (2026-09-05):** [x] Completed and verified against the current source; regression coverage and validation are recorded in CODEX_IMPLEMENTATION_REPORT.md.

- **File**: `apps/web-client/package.json`
- **Problem**: The Board component does not implement drag-and-drop. These packages are installed but never imported.
- **Action**: Remove unused dependencies: `npm uninstall @dnd-kit/core @dnd-kit/sortable`.

---

## Priority Order for Fixes

### P0 — Fix Immediately (Correctness / Security)
1. [x] [2.3] Hardcoded breadcrumb "Orbit Launch"
2. [x] [2.4] Hardcoded avatar "AM"
3. [x] [3.2] Logout not sending refresh token
4. [x] [10.1] `defaultValue` not updating on re-fetch (data loss risk)

### P1 — Fix Soon (Reliability / Consistency)
5. [x] [2.2] `MarkAllRead` not pipelined
6. [x] [4.2] Refresh endpoint body mismatch
7. [x] [5.1] Dead WebSocket code with no server
8. [x] [2.5] Query key collision risk
9. [x] [6.2] Expired refresh token cleanup
10. [x] [8.1] IAM tests skipped in CI

### P2 — Improve (Performance / Quality)
11. [x] [5.2] Outbox publisher not batching
12. [ ] [5.4] N+1 access checks in notification consumer
13. [x] [11.1] Gateway adapter DRY extraction
14. [x] [6.3] Inconsistent timestamp precision
15. [x] [7.2] Notification service correlation ID format
16. [x] [11.4] Duplicate email normalization

### P3 — Polish (DX / Maintenance)
17. [x] [5.3] Remove unused `useIssueStore`
18. [x] [11.5] Remove unused `@dnd-kit` dependencies
19. [x] [10.5] Add page titles/metadata
20. [x] [10.2] Add error states to queries
21. [x] [7.1] Add error detail logging
22. [x] [7.3] Set `DomainError.name`
23. [x] [9.1] Docker Compose secret management
24. [x] [9.4] .NET CI unit test step

---

## Verification Checklist

After completing fixes, verify:

- [x] `docker compose up --build` starts all services without errors
- [x] `GET /health/services` returns all services healthy
- [x] Full issue lifecycle: create workspace -> create project -> create issue -> transition -> comment -> verify notification
- [x] Login -> refresh -> logout flow works end-to-end
- [x] Local equivalents for `node`, `java`, `dotnet`, `go`, `issue-lifecycle-postgres`, `project-access-postgres`, `compose-contract` pass; hosted GitHub Actions were not dispatched.
- [x] No TypeScript/ESLint errors in web-client (`npm run typecheck && npm run lint`)
- [x] All available test suites pass (`npm test` in each Node app, `mvn verify` in IAM, `dotnet test` in Project, `go test ./...` in Notification)


## Implementation decisions and validation (2026-09-05)

- Confirmed P0 -> P1 -> P2 -> P3 work against current source and canonical product/architecture docs. No new lifecycle, recipient, data-owner, or event rules were invented.
- Preserved documented HttpOnly refresh cookies, flat Project GET responses, service ownership, validation layers and five-second notification polling. No cross-service boundary change required an ADR.
- Redis mark-all uses a transaction pipeline and conditional Lua updates, preserving readAt/TTL and avoiding expired-hash resurrection. Outbox publication is one Kafka send per fetched batch and remains at-least-once.
- IAM cleanup is configurable hourly by default, runs transactionally, and does not change active-session semantics. Error logging records stable codes/correlation and diagnostic frames without raw request/error secrets.
- The stale smoke transition body was corrected to include expectedVersion. The PowerShell harness uses curl cookie jars for Secure localhost behavior and verifies logged-out refresh rejection.
- Validation passed: web 52 tests + typecheck/lint/build; Gateway 28 tests + build; Issue 14 tests + integration/build; IAM Java 17 verify (3 tests); .NET 42 tests including PostgreSQL; Go race tests/build with Redis; Compose config/start and /health/services; full lifecycle/authentication smoke.
- Production npm audit has no high/critical findings after the targeted fast-uri 3.1.7 patch; three moderate Fastify/qs advisories remain and require a future dependency-major decision. CodeGraphContext was queried before adapter refactoring and the forced reindex completed successfully after structural changes.
