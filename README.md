# Jira-like Polyglot Microservices MVP

Month 1 goal: build a runnable vertical slice of a Jira-like microservices system. This is not a full Jira clone.

## Week 1 Scope

- Monorepo skeleton for five services.
- Docker Compose local infrastructure: PostgreSQL, Redis, Redpanda.
- `GET /health` on every service.
- API Gateway health aggregation at `GET /health/services`.
- Local run guide, health contract, and troubleshooting notes.

Out of scope for week 1: Google Login, JWT, Kubernetes, Elasticsearch, WebSocket, frontend, advanced CI/CD, and full permission modeling.

## Week 3 Scope

- Project Service owns `project_db` with `workspaces`, `workspace_members`, and `projects`.
- Public clients use Gateway routes: `POST /api/workspaces`, `GET /api/workspaces`, and `POST /api/workspaces/{workspaceId}/projects`.
- Gateway validates JWTs and forwards authenticated user context to Project Service.
- Project Service creates OWNER membership with workspace creation and authorizes project creation for OWNER/ADMIN members.

See [Week 3 Project Service Contract](docs/api/project-service-contract.md) for the API contract, schema, and smoke tests.

## Services

| Service | Stack | Port | Health URL |
| --- | --- | ---: | --- |
| API Gateway | NestJS | 3000 | `http://localhost:3000/health` |
| IAM Service | Spring Boot | 8081 | `http://localhost:8081/health` |
| Project Service | ASP.NET Core Minimal API | 8082 | `http://localhost:8082/health` |
| Issue Service | NestJS | 8083 | `http://localhost:8083/health` |
| Notification Service | Go | 8084 | `http://localhost:8084/health` |

## Prerequisites

- Docker Desktop with Docker Compose v2.
- Node.js 20+ if running NestJS services outside Docker.
- Java 17+ and Maven if running IAM outside Docker.
- .NET SDK 9 if running Project Service outside Docker.
- Go 1.22+ if running Notification Service outside Docker.
- `curl`, Postman, or Bruno for testing.

## Run With Docker Compose

```bash
cd infra/docker-compose
cp .env.example .env
docker compose build
docker compose up -d
docker compose ps
```

## Test Health

From the repository root:

```bash
bash scripts/health-check.sh
```

On Windows PowerShell:

```powershell
pwsh -NoProfile -File scripts/health-check.ps1
```

Or run the checks manually:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/services
curl http://localhost:8081/health
curl http://localhost:8082/health
curl http://localhost:8083/health
curl http://localhost:8084/health
```

Expected service health response:

```json
{
  "status": "ok",
  "service": "iam-service",
  "version": "0.1.0",
  "timestamp": "2026-06-24T00:00:00.000Z",
  "dependencies": {
    "database": "not_checked",
    "redis": "not_applicable",
    "kafka": "not_checked"
  }
}
```

## Stop And Reset

```bash
cd infra/docker-compose
docker compose down
```

Reset volumes when you need PostgreSQL init scripts to run again:

```bash
cd infra/docker-compose
docker compose down -v
docker compose up -d
```

## Local Service Commands

API Gateway:

```bash
cd apps/api-gateway-nest
npm install
npm run start:dev
```

IAM Service:

```bash
cd apps/iam-service-java
mvn spring-boot:run
```

Project Service:

```bash
cd apps/project-service-dotnet
dotnet run
```

Apply Project Service EF migration outside Docker:

```powershell
cd apps/project-service-dotnet
$env:DATABASE_URL = "Host=localhost;Port=5432;Database=project_db;Username=postgres;Password=postgres"
dotnet ef database update
```

Issue Service:

```bash
cd apps/issue-service-nest
npm install
npm run start:dev
```

Notification Service:

```bash
cd apps/notification-service-go
go run .
```

## Troubleshooting

- If PostgreSQL init databases are missing, run `docker compose down -v` from `infra/docker-compose`, then start again.
- If a service port is already in use, change only the host port mapping in `docker-compose.yml`; keep container ports stable.
- Inside Docker, services call each other by Compose service name such as `http://iam-service:8081`, not `localhost`.
- If `GET /health/services` shows a downstream service as `down`, check the target container logs first.
- If `bash scripts/health-check.sh` fails on Windows because Bash is unavailable, run `pwsh -NoProfile -File scripts/health-check.ps1`.

## Week 2 Preparation

- Choose the IAM auth strategy: JWT access plus refresh token, or session.
- Design a minimal user table.
- Define `register`, `login`, and `me` endpoint contracts.
- Decide password hashing defaults.
- Decide whether Gateway validates tokens locally or delegates validation to IAM.
- Keep Google Login deferred until local username/password auth works.
