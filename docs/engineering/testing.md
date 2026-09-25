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

The CI `e2e-compose` job builds and starts the Compose stack, runs `scripts/smoke-full-flow.sh` through the Gateway, and uploads Compose logs on failure. The smoke script waits until `/health/services` reports `ok`, requires `GET http://localhost:3001/login` on the web client to return `200`, then requires an `issue.transitioned` notification for the created issue to arrive through Kafka.

The PostgreSQL lifecycle suite must use `ISSUE_SERVICE_TEST_DATABASE_URL` for the dedicated disposable `issue_test_db` only. It refuses to reset `issue_db`. CI runs the suite against that test database and verifies same-version transition concurrency, failure rollback, and issue list filters, limits, and cursor stability while issues are created between pages; it is not an optional release gate.

## Contract tests

The JSON Schemas (draft 2020-12) in `contracts/` state the documented cross-service contracts. Consumer and provider tests validate against the same files, so a changed response or event shape fails CI on the side that changed.

| Schema | Contract | Source |
| --- | --- | --- |
| `contracts/http/error.schema.json` | `{ code, message, correlationId, details }` from every service and the Gateway | [errors](../api/errors.md) |
| `contracts/http/iam.schema.json` | IAM register, login, and refresh bodies; Gateway reads `refreshToken` | [authentication](../api/authentication.md) |
| `contracts/http/project.schema.json` | Project workspace, member, and project bodies, plus internal access-context | [workspaces](../api/workspaces.md), [projects](../api/projects.md) |
| `contracts/http/issue.schema.json` | Issue, comment, history, epic, and sprint bodies | [issues](../api/issues.md), [comments](../api/comments.md), [planning](../api/planning.md) |
| `contracts/http/notification.schema.json` | Notification list | [notifications](../api/notifications.md) |
| `contracts/events/issue-event-v1.schema.json` | `issue.events.v1` envelope | [event contracts](../../contracts/events/README.md) |

A schema constrains wrapper keys, the fields and enums the API page names, and documented nullability. Fields the docs do not name are unconstrained, and additive fields pass.

| Side | Test | CI job |
| --- | --- | --- |
| Gateway consumer | Adapter and auth-controller specs validate every mocked IAM, Project, Issue, and Notification body and error before returning it (`src/testing/contracts.ts`, ajv) | `node` |
| Gateway provider | `issues.controller.spec.ts` validates the public error envelope | `node` |
| IAM provider | `AuthContractTest` starts IAM on H2 and validates real `/auth/*` success and error bodies (networknt json-schema-validator) | `java` |
| Project provider | `ProjectApiPostgresIntegrationTests` validates every project, workspace, member, access-context, and error body (JsonSchema.Net) | `project-access-postgres` |
| Issue provider | The PostgreSQL suite validates response bodies and every message the outbox publisher sends to Kafka; `domain-exception.filter.spec.ts` validates the error envelope | `issue-lifecycle-postgres`, `node` |
| Issue consumer | `project-access.client.spec.ts` reads a schema-valid access context and `404 PROJECT_NOT_FOUND` envelope | `node` |
| Notification | The consumer projects a schema-valid event of every type; the Project access client reads schema-valid access-context and `404` bodies; the API test validates error envelopes and, with Redis, the list body (santhosh-tekuri/jsonschema) | `go` |

Validators are test-scope dependencies. Tests read `contracts/` relative to the repository root; the .NET test project copies it next to the test assembly. Run them with each service's normal test command; the PostgreSQL and Redis cases need `ISSUE_SERVICE_TEST_DATABASE_URL`, `PROJECT_SERVICE_TEST_DATABASE_URL`, and `NOTIFICATION_TEST_REDIS_URL`. The `compose-contract` job checks that every file in `contracts/` is valid JSON.

A contract change updates the `docs/api` page and its schema together. An incompatible change requires an ADR ([dependency rules](../architecture/dependency-rules.md)); an incompatible event change also requires a new schema version and topic.
