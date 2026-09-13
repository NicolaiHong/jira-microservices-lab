# Repository guidance

## Documentation first

Documentation is the business and architecture source of truth. Before implementing a feature, read:

1. `docs/product/requirements.md` and `docs/product/business-rules.md`;
2. `docs/architecture/overview.md` and `docs/architecture/dependency-rules.md`;
3. the relevant `docs/flows/*.md` and `docs/features/*.md` pages; and
4. relevant API, data, and reference pages.

Do not invent missing business rules or silently expand scope. If documentation, tests, and implementation conflict, report the conflict before changing architectural behaviour. Prefer the smallest implementation that satisfies the documented requirement. Architecture, service-boundary, data-owner, event, or cross-service-contract changes require an ADR in `docs/decisions/`.

## System map

- `apps/api-gateway-nest`: NestJS/Fastify edge gateway; public routing, JWT validation, correlation propagation, error translation.
- `apps/iam-service-java`: Spring Boot IAM; users, passwords, JWTs, refresh-token sessions.
- `apps/project-service-dotnet`: ASP.NET Core; workspaces, membership, projects, project lifecycle.
- `apps/issue-service-nest`: NestJS; issues, comments, history, planning, transactional outbox.
- `apps/notification-service-go`: Go; Kafka consumer and Redis notification projection.
- `apps/web-client`: Next.js browser client; calls Gateway only.

## Boundaries

- Keep the gateway thin. Do not put domain state or owning-service business rules there.
- Each service owns its persistence: `iam_db`, `project_db`, `issue_db`, and Redis notifications. Never read/write another service's store.
- Use synchronous HTTP only for request-time checks; use `issue.events.v1` for issue-event notification propagation. Do not add distributed transactions.
- Preserve `x-correlation-id`; never log credentials, JWTs, refresh tokens, or internal secrets.

## Local workflow

- Start from `infra/docker-compose` with `docker compose up --build`.
- Check `GET /health/services` through Gateway first; component health is `/health`.
- Run focused builds: Node `npm run build`, Java `mvn package -Dmaven.test.skip=true`, .NET `dotnet build ProjectService.csproj`, Go `go build ./...`.

## CodeGraphContext

- The local-only graph lives in `.codegraphcontext/` and uses embedded KuzuDB. Query it before large code refactors; confirm graph results in source if it reports ambiguity.
- Reindex with `.\\scripts\\cgc.ps1 index --force --summarize` after structural changes. Stop a watcher before running a query because KuzuDB takes an exclusive lock.
