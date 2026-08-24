# Jira-like Polyglot Microservices MVP

A learning-oriented Jira-like vertical slice that demonstrates synchronous service calls, local database ownership, transactional Outbox, Kafka delivery, Redis-backed notifications, and a Next.js client that talks only to the API Gateway.

## Implemented Flow

```text
Web Client (:3001)
  -> API Gateway (:3000, JWT + rate limit + correlation ID)
     -> IAM / Spring Boot (internal :8081, iam_db)
     -> Project / ASP.NET Core (internal :8082, project_db)
     -> Issue / NestJS (internal :8083, issue_db)
          -> transactional Outbox -> Redpanda topic issue.events.v1
                                      -> Notification / Go (internal :8084, Redis)
```

The MVP supports register/login/refresh/logout/me, workspace membership, project lifecycle, issue create/edit/assignment/workflow/comments/history, and notification list/read operations. The fixed Issue workflow is `TODO → IN_PROGRESS`, `IN_PROGRESS → TODO|DONE`, and `DONE → IN_PROGRESS`; `DONE` is reopenable and the Board uses buttons rather than drag-and-drop. Private resources return not-found behavior to non-members. Project archive is soft-delete: Issue reads remain available while applicable client write controls are read-only and Issue writes are rejected.

## Services

| Service              | Stack                   | Owned data          |          Port |
| -------------------- | ----------------------- | ------------------- | ------------: |
| Web Client           | Next.js 16 / React 19   | Browser session     |          3001 |
| API Gateway          | NestJS                  | Redis rate limits   |          3000 |
| IAM Service          | Spring Boot 3 / Java 17 | `iam_db`            | internal 8081 |
| Project Service      | ASP.NET Core / .NET 9   | `project_db`        | internal 8082 |
| Issue Service        | NestJS                  | `issue_db` + Outbox | internal 8083 |
| Notification Service | Go                      | Redis inbox/dedup   | internal 8084 |

PostgreSQL, Redis, and Redpanda run only on the internal Compose network. A service never reads another service's database; Issue checks project access through an internal HTTP contract.

## Start the Backend

Prerequisite: Docker Desktop with Compose v2.

```bash
cd infra/docker-compose
cp .env.example .env
docker compose up --build
```

Migrations run automatically: Flyway in IAM, EF migrations in Project startup/container flow, and ordered idempotent Issue SQL migrations at Issue startup. Keep the terminal open to watch structured JSON logs. Send the same `x-correlation-id` header to follow one synchronous request across Gateway, Project, and Issue.

In another terminal:

```bash
bash scripts/health-check.sh
```

Windows:

```powershell
pwsh -NoProfile -File scripts/health-check.ps1
```

## Start the Frontend

```bash
cd apps/web-client
npm ci
npx next dev -H 0.0.0.0 -p 3001
```

The default Gateway URL is `http://localhost:3000`. Override it in `apps/web-client/.env.local` with `NEXT_PUBLIC_API_GATEWAY_URL`.

Open `http://localhost:3001/register`, create an account, then create a workspace, project, and issue.

## Run the Full Smoke Flow

The script creates two real users and exercises both synchronous HTTP and asynchronous Kafka notification paths:

```powershell
pwsh -NoProfile -File scripts/smoke-full-flow.ps1
```

If port `3000` is already occupied, start Gateway on another host port and pass it to the smoke script:

```powershell
$env:API_GATEWAY_PORT = "3100"
docker compose -f infra/docker-compose/docker-compose.yml up -d api-gateway
pwsh -NoProfile -File scripts/smoke-full-flow.ps1 -GatewayUrl http://localhost:3100
```

```bash
bash scripts/smoke-full-flow.sh
```

Inspect the Kafka topic while the flow runs:

```bash
docker exec local-redpanda rpk topic consume issue.events.v1 --brokers localhost:9092
```

Follow service logs:

```bash
docker compose -f infra/docker-compose/docker-compose.yml logs -f api-gateway project-service issue-service notification-service
```

For synchronous HTTP, copy the `correlation=...` value printed by the smoke script and filter every service log by that value. For the asynchronous branch, match the `eventId` in Issue's `outbox_event_published` log with Notification's `event_consumed` log. A correlation ID follows one request; an event ID follows one Kafka message.

## Verification Commands

```bash
cd apps/api-gateway-nest && npm ci && npm audit --omit=dev && npm test && npm run build
cd apps/issue-service-nest && npm ci && npm test && npm run build
# Lifecycle PostgreSQL integration coverage is mandatory in CI and requires its dedicated disposable database locally.
ISSUE_SERVICE_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/issue_test_db npm run test:integration
cd apps/web-client && npm ci && npm run lint && npm test && npm run typecheck && npm run build
cd apps/iam-service-java && mvn -B test
dotnet test tests/project-service-dotnet-tests/ProjectService.Tests.csproj
cd apps/notification-service-go && go test ./... && go build ./...
```

CI runs the ecosystem-specific tests/build gates plus Docker Compose contract validation. The Issue lifecycle PostgreSQL integration suite runs against a dedicated disposable test database, not `issue_db`. The event envelope lives at `contracts/events/issue-event-v1.schema.json`.

## Important Learning Boundaries

- Ports `8081`–`8084` are exposed locally for debugging. In production, only Gateway should be public and internal identity headers must be accepted only over a trusted private network or authenticated service-to-service channel.
- Only Gateway is exposed. Downstream services stay on the Compose network and reject requests without the internal service credential; this prevents a caller from forging `x-authenticated-user-id` by calling a downstream port directly.
- Refresh tokens are stored in a `HttpOnly`, `SameSite=Strict` gateway cookie. The browser only persists the short-lived access token and user profile.
- Notifications use polling every five seconds. WebSocket delivery is deliberately optional because Kafka correctness and persisted inbox behavior come first.
- Redis is the Notification data store for the learning slice; long-term audit/reporting requirements would usually justify durable database persistence.

The implementation roadmap and Definition of Done are in [`plans/BACKEND_FIRST_MVP_PLAN.md`](plans/BACKEND_FIRST_MVP_PLAN.md).
