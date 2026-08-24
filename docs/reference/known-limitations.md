# Known Limitations

## VERIFIED

- The active issue list endpoint has no query filters, pagination, or server-side search.
- Notification delivery is asynchronous and at-least-once; Redis projection idempotency avoids duplicate event/recipient notifications, but exactly-once delivery is not claimed.
- Notification records expire after 90 days in Redis.
- The application has no verified workspace/project member-management UI, and assignee input uses a member UUID.
- WebSocket helper code exists in the client, but no server socket contract is implemented; notifications use five-second polling.
- Canonical documentation and the checked-in lifecycle test sources are tracked explicitly; generated test outputs remain ignored.
- Issue Service authorizes against Project Service immediately before a write, but the two services cannot atomically lock a workspace membership or project lifecycle together. This accepted cross-service TOCTOU limitation is intentionally unresolved; PostgreSQL compare-and-swap still protects Issue-local concurrent writes.
- Transition requests have no idempotency-key guarantee. Clients must use the returned/current Issue version and handle `CONCURRENT_ISSUE_MODIFICATION`; they must not assume duplicate submissions collapse to one command.
- The Board offers button-based legal status moves only. Drag-and-drop status movement is intentionally not implemented.
