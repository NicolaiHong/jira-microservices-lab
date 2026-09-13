# Codex Implementation Report

Implemented on 2026-09-05, in P0 → P1 → P2 → P3 order. Findings were checked against current source and the documented business rules before modification. No service ownership, issue workflow, database schema, or event-envelope contract was changed.

## Completed

Paths below are repository-relative. Tests accompany the changed behavior.

| Finding ID | What changed | Files changed |
| --- | --- | --- |
| 2.3 | Project breadcrumbs use the loaded project name. | `apps/web-client/src/app/(dashboard)/projects/[projectId]/{board,backlog,roadmap}/page.tsx`; board page test; `features/issue/project-pages.test.tsx` |
| 2.4 | Replaced invented assignee initials with an accessible generic user icon identifying assigned/unassigned state in board and backlog views. The Issue API supplies an ID, not a user display name. | `apps/web-client/src/features/issue/components/Board/Board.tsx`, `Board.test.tsx`, `apps/web-client/src/features/issue/components/Backlog/Backlog.tsx`, `Backlog.test.tsx` |
| 3.2, 4.2, 8.4 | Verified existing HttpOnly-cookie logout/refresh forwarding. Added revocation, cookie clearing/rotation, missing-cookie, refresh failure, concurrent deduplication, and replay-limit regressions. No browser refresh-token body or token persistence was added. | Gateway `src/presentation/auth/auth.controller.spec.ts`; web `src/lib/interceptors.test.ts`; `scripts/smoke-full-flow.ps1`, `.sh` |
| 10.1 | Version-keyed edit and assignment forms reload current values after refetch. Comment drafts remain intact. | Web `features/issue/components/IssueDetailModal/IssueDetailModal.tsx`, `.test.tsx` |
| 2.2 | Mark-all-read now uses a single Redis transaction pipeline after loading IDs. Conditional Lua updates preserve read timestamps and TTLs and never recreate expired hashes. | `apps/notification-service-go/internal/store/redis_store.go`, `redis_store_integration_test.go` |
| 2.5 | Detail/comment/history keys use `issue`; project lists use `issues/list`. Updated all invalidations and tested equal UUIDs across detail/list caches. | Web `features/issue/hooks/useIssue.ts`, `useIssues.ts`, corresponding tests, `query-keys.test.tsx`; `IssueDetailModal.tsx` |
| 5.1 | Removed unused WebSocket helpers and configuration; retained the already implemented five-second REST polling. | Deleted web `src/lib/socketClient.ts`, `features/notification/socket.ts`; updated `.env.local.example`, `docs/reference/known-limitations.md` |
| 6.2 | Hourly configurable cleanup deletes expired or revoked refresh tokens in a transaction. A fixed-clock persistence test verifies deletion boundaries, idempotency, and retention of active tokens/users. | IAM `infrastructure/persistence/RefreshTokenCleanup.java`, `jpa/RefreshTokenJpaRepository.java`, `infrastructure/config/ApplicationConfig.java`, `application.yml`, `pom.xml`, `RefreshTokenCleanupTest.java` |
| 8.1 | CI runs `mvn -B verify`. Corrected ignored IAM test source so the pre-existing rotation test and new tests are included in version control. | `.github/workflows/ci.yml`, `.gitignore`; IAM `src/test/java/.../RefreshSessionUseCaseTest.java` |
| 5.2 | Publishes each fetched outbox batch in one Kafka send, preserving message order, aggregate keys and schema version. Marks rows only after acknowledgement. Failed sends keep every row retryable; marker failures remain retryable individually. | Issue `src/infrastructure/outbox.publisher.ts`, `.spec.ts`, `package.json` |
| 11.1, 8.2 | Extracted shared timeout, forwarding, correlation/credential propagation, logging and error translation. Preserved adapter-specific response and request-body conventions. Added transport and service-level regression tests. | Gateway `src/infrastructure/http-clients/internal-service-http.client.ts`, `.spec.ts`; `iam-service.adapter.ts`, `project-service.adapter.ts`, `issue-service.adapter.ts`, `notification-service.adapter.ts`; `src/services/services.spec.ts`, `package.json` |
| 6.3 | All three remaining application use cases now use the existing PostgreSQL microsecond timestamp helper. | Project `Application/UseCases/AddWorkspaceMemberUseCase.cs`, `ChangeWorkspaceMemberRoleUseCase.cs`, `CreateWorkspaceUseCase.cs`; `tests/project-service-dotnet-tests/ProjectUseCaseTests.cs` |
| 7.2 | Missing correlation IDs use UUID v4; supplied IDs still propagate unchanged. | Notification `internal/api/handler.go`, `handler_test.go`, `go.mod`, `go.sum` |
| 11.4 | Login and registration share locale-independent email normalization. Existing entity normalization was left alone. | IAM `application/usecase/{EmailNormalizer,LoginUseCase,RegisterUseCase}.java`, `EmailNormalizerTest.java` |
| 5.3, 11.5 | Removed unused Issue UI store and both unused drag-and-drop dependencies. | Deleted web `features/issue/store.ts`; web `package.json`, `package-lock.json` |
| 10.2, 10.5 | Added loading/error/retry handling to board, backlog, roadmap and issue detail; page-specific metadata/titles use existing Next/React APIs. Root redirect retains root metadata. | Web project route pages, login/register/project-list pages; `components/shared/QueryError.tsx`; `BoardScreen.tsx`; `project-pages.test.tsx` |
| 10.3 | Verified the actual Board → IssueForm → create mutation flow and added a regression. | Web `features/issue/components/Board/BoardScreen.test.tsx` |
| 7.1, 7.3 | Server errors log correlation, status, stable code and diagnostic stack frames; raw exception messages/request secrets are omitted. Set `DomainError.name`. | Issue `src/presentation/domain-exception.filter.ts`, `.spec.ts`, `src/domain/errors.ts`, `package.json` |
| 3.1, 3.4 | Documented localStorage exposure and internal-secret trust boundaries at identity readers. | Web `features/auth/store.ts`; Issue `presentation/request-context.ts`; Project `Api/AuthContext.cs`; Notification `internal/api/handler.go` |
| 3.3 | Login/registration already had Redis limits. Added refresh limiting using that adapter, prevented raw forwarded headers from selecting rate buckets, and retained cookies on 429. | Gateway `src/services/auth.service.ts`, `src/presentation/auth/auth.controller.ts`, corresponding tests; `docs/api/authentication.md` |
| 9.2 | CI explicitly rejects high/critical production dependency advisories. Verification found a vulnerable existing exact `fast-uri` pin; updated only that transitive pin to 3.1.7 in both Nest services. | CI; Gateway/Issue `package.json`, `package-lock.json` |
| 9.3, 9.4 | CI reads Go version from go.mod and runs .NET unit tests independently of PostgreSQL. Added a Redis CI service for the mark-all integration test. | `.github/workflows/ci.yml` |
| Reporting | Recorded finding outcomes and validation; allowed the two requested root Markdown deliverables through the repository's Markdown ignore rule. | `CODEBASE_REVIEW_AND_REFACTOR_PLAN.md`, `CODEX_IMPLEMENTATION_REPORT.md`, `.gitignore` |

## Skipped / Requires Clarification

| Finding ID | Reason |
| --- | --- |
| 2.1 | Intentionally unchanged. BR-STATUS-001 explicitly permits `DONE → IN_PROGRESS`; no lifecycle clarification is needed. |
| 3.1 | Memory-only access-token storage remains a product/security-policy decision explicitly open in `docs/architecture/auth-and-security.md`. Implemented the plan's minimum risk comment, without inventing bootstrap behavior. |
| 3.2, 4.2 | Suggested body changes skipped: Gateway already extracts the HttpOnly cookie and forwards the token to IAM. Existing architecture was verified and protected with tests instead. |
| 4.1 | Flat GET response is intentional in `docs/api/projects.md` and `docs/api/conventions.md`. Changing it would unnecessarily break the documented contract. |
| 4.3 | Audited all five event insertions. Each supplies deduplicated non-actor recipients. Created: assignee; updated/transitioned/commented: reporter and assignee; assigned: reporter and new assignee. The review's old-assignee claim is inaccurate. No documented requirement mandates adding previous assignees; any recipient-policy expansion needs clarification. |
| 4.4 | Already covered by `ProjectApiPostgresIntegrationTests`: real HTTP assertions check all five camelCase access-context fields, active/archived access and removed membership. The full suite passed. |
| 5.4 | Optional optimization declined. Current producer payloads have at most two candidate recipients. Retained bounded sequential access checks and the existing all-checks-before-Redis behavior; no batch endpoint or cross-service contract added. |
| 6.1 | Already implemented: Issue `Database.onModuleInit` sorts and applies the SQL files; Docker copies them into the runtime image. Verified startup against Compose. |
| 8.3 | A new dedicated Kafka/testcontainers consumer suite was optional. Added real Redis store regression coverage and ran the full Kafka→consumer→Redis smoke flow; existing consumer unit tests still cover offset/DLQ/access failure behavior. |
| 9.1 | Already implemented: every Compose service requires externally supplied `INTERNAL_SERVICE_SECRET`; `.env.example` contains explicitly local placeholders. Configuration validation passed. |
| 10.4 | Reconnection implementation skipped because the unused socket client was removed under 5.1. Notifications retain documented polling. |
| 11.2 | Application-layer validation is intentional and remains unchanged. No speculative DTO/OpenAPI refactor. |
| 11.3 | IAM depends on `spring-security-crypto`, not the web Security starter/filter chain. No default web Security configuration is activated; no unnecessary SecurityFilterChain added. |

## Tests and Validation

Commands run from the corresponding app directory unless a repository-relative path is shown. Logs are available locally under `.codex/` and are ignored by Git.

| Command/check | Result | Relevant details |
| --- | --- | --- |
| P0 web `npm test`, `npm run typecheck`, `npm run lint` | PASS | 40 tests; no type or lint errors. |
| P0 Gateway `npm test`, `npm run build` | PASS | 22 tests, including cookie logout/refresh regressions. |
| P1 web `npm test` | PASS | 43 tests, including concurrent refresh and failure paths. |
| P1 IAM `mvn -B verify` | PASS | Rotation and cleanup persistence tests. |
| P1 Go `go test ./...` | PASS | Real Redis at an isolated test port; no Redis test skip. |
| P2 Gateway/Issue tests and builds | PASS | 25 tests each at this stage. |
| P2 .NET unit tests | FAIL → PASS | New test initially supplied a string where the command requires Guid. Corrected the test; all 28 unit tests passed. |
| P2 IAM verification and Go tests | PASS | Included normalization and UUID regressions. |
| Final web `npm test` | PASS | 52 tests in 15 files. |
| Final web `npm run typecheck && npm run lint && npm run build` | PASS | Production Next.js 16.3.0 build completed for all routes. |
| Final Gateway `npm test && npm run build` | PASS | 28 tests; production build completed after the fast-uri patch. |
| Final Issue `npm test && npm run build` | PASS | 14 tests; dedicated `issue_test_db` concurrency/rollback coverage passed. |
| IAM `mvn -B verify` on Java 17 | PASS | 3 tests, zero failures/errors/skips; Maven container uses the same Java major as CI. Also passed locally with Java 21 targeting 17. |
| `dotnet test tests/project-service-dotnet-tests/ProjectService.Tests.csproj --configuration Release` | PASS | 42 tests, zero skipped; separate disposable `project_test_db`. |
| `dotnet test ... --filter 'FullyQualifiedName!~Postgres'` | PASS | 28 unit tests without database dependency. |
| Go `go test -race ./... && go build ./...` | PASS | Go 1.22 container, real Redis integration enabled; all five test-bearing packages passed. |
| Node `npm audit --omit=dev --audit-level=high` | PASS | Gateway and Issue exit 0 after pinning `fast-uri` to 3.1.7; only three moderate Fastify/qs advisories remain below the gate. Web production audit has zero advisories. |
| `docker compose config --quiet` | PASS | Required external secret resolved without printing it. |
| `docker compose up --build -d` | PASS | Final images rebuilt and started successfully after the dependency patch. |
| `GET /health/services` | PASS | IAM, Project, Issue and Notification all healthy. |
| `scripts/smoke-full-flow.ps1` | FAIL → PASS | First attempt reached refresh but .NET's cookie jar dropped Secure cookies on localhost HTTP. Harness now uses curl cookies without changing application flags. Passed workspace/project/issue creation, versioned transition, comment/history, Kafka notification, mark-read, login/refresh/logout and revoked-token rejection. |
| Event and health JSON syntax checks | PASS | Both checked-in schemas parse. |
| `git diff --check`, UTF-8 source check | PASS | Verified with repository Git line-ending settings. |
| `.\scripts\cgc.ps1 find pattern ServiceAdapter` | PASS | Stopped the local graph process holding its exclusive lock; confirmed all four adapters against source before extraction. |
| `.\scripts\cgc.ps1 index --force --summarize` | PASS | Structural reindex completed successfully after the adapter refactor. |

Hosted GitHub Actions were not dispatched. The repository jobs' local equivalents were exercised; this report does not claim a hosted CI run.

## Remaining Risks

- LocalStorage access-token exposure remains the documented MVP limitation (3.1); refresh tokens remain HttpOnly and Secure in production.
- Existing Redis auth limiting is fail-open during Redis unavailability. This policy was preserved.
- Moderate Fastify/qs dependency advisories and web development-only dependency advisories remain outside the high/critical production gate; no breaking Nest upgrade was attempted.
- Outbox delivery remains at-least-once. Partial broker delivery or database marker failure may replay events; stable event IDs and consumer deduplication remain required. No stronger cross-batch ordering guarantee was introduced.
- IAM cleanup persistence tests use H2; Compose startup and the authentication smoke use PostgreSQL. No database schema migration was required.
- Existing notification access-check/write TOCTOU and polling behavior remain as documented. Previous-assignee notification policy requires a product decision if expanded.
- Local Node 22.12 printed an ESLint transitive engine warning and Vitest ESM warning; tests, lint, typecheck and production build passed. CI selects the current Node 22 release.

## Final Status

READY — confirmed findings were implemented in priority order, intentionally skipped findings are documented with reasons, and all required local verification checks passed.
