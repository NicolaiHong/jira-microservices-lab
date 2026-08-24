# Local Development

## Purpose

Run and observe the local stack.

1. Copy `infra/docker-compose/.env.example` to a local `.env` and set `INTERNAL_SERVICE_SECRET`.
2. From `infra/docker-compose`, run `docker compose up --build`.
3. Check `GET http://localhost:3000/health/services` through the gateway; each component exposes `/health` internally.
4. Run focused service builds: Nest `npm run build`, IAM `mvn package -Dmaven.test.skip=true`, Project `dotnet build ProjectService.csproj`, Notification `go build ./...`.
5. Use `scripts/smoke-full-flow.ps1` or `.sh` for the documented full-flow smoke path when applicable.

Use `x-correlation-id` to trace a request. Never place access tokens, refresh tokens, passwords, or the internal secret in logs or committed environment files.
