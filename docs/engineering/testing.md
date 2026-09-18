# Testing

## Purpose

Expected verification for a vertical slice.

| Layer | Verify |
| --- | --- |
| Domain/use case | Invariants, roles, state transitions, lifecycle rules |
| Persistence | Migrations, constraints, uniqueness, transaction/concurrency behaviour |
| HTTP | Validation, authorization, error mapping, correlation propagation |
| Contract | Gateway-service and event envelope compatibility |
| End-to-end | A gateway-routed business flow plus relevant event projection |

Issue lifecycle verification includes checked-in Issue Service domain/application tests, a real PostgreSQL lifecycle integration suite, Gateway transition forwarding/auth/error tests, and web-client Board/archive-gating tests. `.gitignore` permits those source test paths; generated outputs remain ignored.

The CI `e2e-compose` job builds and starts the Compose stack, runs `scripts/smoke-full-flow.sh` through the Gateway, and uploads Compose logs on failure. The smoke script waits until `/health/services` reports `ok`, then requires an `issue.transitioned` notification for the created issue to arrive through Kafka.

The PostgreSQL lifecycle suite must use `ISSUE_SERVICE_TEST_DATABASE_URL` for the dedicated disposable `issue_test_db` only. It refuses to reset `issue_db`. CI runs the suite against that test database and verifies same-version transition concurrency plus failure rollback; it is not an optional release gate.
