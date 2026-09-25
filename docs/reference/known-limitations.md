# Known Limitations

## VERIFIED

- The issue list filters by status, assignee, sprint, and summary substring only; it has no sort options, priority or key filter, or full-text search. Board and Backlog follow `nextCursor` to load their complete list, one request per 50 issues ([ADR 0005](../decisions/0005-issue-list-pagination-and-filtering.md)).
- Notification delivery is asynchronous and at-least-once; Redis projection idempotency avoids duplicate event/recipient notifications, but exactly-once delivery is not claimed.
- Notification records expire after 90 days in Redis.
- Members are added only by the email of an already-registered account; there is no invitation flow.
- Notifications use five-second polling; no WebSocket server contract is implemented.
- Canonical documentation and the checked-in lifecycle test sources are tracked explicitly; generated test outputs remain ignored.
- Issue Service authorizes against Project Service immediately before a write, but the two services cannot atomically lock a workspace membership or project lifecycle together. This accepted cross-service TOCTOU limitation is intentionally unresolved; PostgreSQL compare-and-swap still protects Issue-local concurrent writes.
- Transition requests have no idempotency-key guarantee. Clients must use the returned/current Issue version and handle `CONCURRENT_ISSUE_MODIFICATION`; they must not assume duplicate submissions collapse to one command.
- Comment POST requests also have no idempotency-key guarantee. A client preserves its entered comment and refreshes Issue-related queries on `CONCURRENT_ISSUE_MODIFICATION`; it must not retry an uncertain business mutation automatically.
- Notification Service rechecks current Project membership before Redis projection. The check and subsequent Redis write cannot be one atomic transaction, so access can change in the accepted TOCTOU interval; a Project outage delays projections and can increase Kafka lag.
- An outbox event abandoned after 20 failed publish attempts is not requeued automatically, and it blocks every later event of the same Issue until an operator resets it with the SQL in [Health API](../api/health.md#issue-service-health). Events of other Issues keep publishing ([ADR 0004](../decisions/0004-outbox-claim-and-per-aggregate-ordering.md)).
- Issue events are ordered per Issue only, and each Issue advances at most one event per two-second publisher poll.
- The Board offers button-based legal status moves only. Drag-and-drop status movement is intentionally not implemented.
- All services share one `INTERNAL_SERVICE_SECRET`. Project, Issue and Notification Services trust `x-authenticated-user-id` on any request that carries that secret, so a compromised service can call another service as any user. There are no per-service credentials or mTLS.
