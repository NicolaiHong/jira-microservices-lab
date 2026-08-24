# Known Limitations

## VERIFIED

- The active issue list endpoint has no query filters, pagination, or server-side search.
- Notification delivery is asynchronous and at-least-once; Redis projection idempotency avoids duplicate event/recipient notifications, but exactly-once delivery is not claimed.
- Notification records expire after 90 days in Redis.
- The application has no verified workspace/project member-management UI, and assignee input uses a member UUID.
- WebSocket helper code exists in the client, but no server socket contract is implemented; notifications use five-second polling.
- The repository currently ignores `docs/` and most Markdown files in `.gitignore`; this migration changes that so canonical documentation can be tracked.
- Issue Service authorizes against Project Service immediately before a write, but the two services cannot atomically lock a workspace membership or project lifecycle together. This accepted cross-service TOCTOU limitation is intentionally unresolved; PostgreSQL compare-and-swap still protects Issue-local concurrent writes.
