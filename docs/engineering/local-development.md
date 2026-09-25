# Local Development

## Purpose

Run and observe the local stack.

1. Copy `infra/docker-compose/.env.example` to a local `.env` and set `INTERNAL_SERVICE_SECRET` and `JWT_SECRET` (at least 32 bytes).
2. From `infra/docker-compose`, run `docker compose up --build` (add `--wait` to block until every container is healthy). This starts the backend and the web client.
3. Check `GET http://localhost:3000/health/services` through the gateway; each component exposes `/health` internally.
4. Open the web client at `http://localhost:3001` and register or sign in. It calls the gateway at `NEXT_PUBLIC_API_GATEWAY_URL`, which is baked in at image build time, so rebuild with `docker compose up --build web-client` after changing it. To run `next dev` with hot reload on port 3001, stop the container first with `docker compose stop web-client`.
5. Run focused service builds: Nest `npm run build`, IAM `mvn package -Dmaven.test.skip=true`, Project `dotnet build ProjectService.csproj`, Notification `go build ./...`.
6. Use `scripts/smoke-full-flow.ps1` or `.sh` for the documented full-flow smoke path. It checks that the web client serves `/login`, then runs the API flow through the gateway. The bash script needs `curl` and `jq`. Each run registers two users, and the gateway allows five registrations per IP every 10 minutes. To rerun sooner, delete the counters: `docker exec local-redis sh -c 'redis-cli --scan --pattern "rate:auth:register:*" | xargs -r redis-cli del'`.

Use `x-correlation-id` to trace a request. Never place access tokens, refresh tokens, passwords, or the internal secret in logs or committed environment files.
