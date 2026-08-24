# Issues Feature

## Purpose

Core work-item creation, retrieval, update, assignment, and fixed workflow.

## Related Requirements

ISSUE-001, ISSUE-002.

## Related Business Flows

[Issue lifecycle](../flows/issue-lifecycle.md), [assignment](../flows/issue-assignment.md), [status transition](../flows/status-transition.md).

## Responsibilities

Issue Service owns issue state, sequence, history, and outbox; Project Service supplies authorization/project status.

## UI

Backlog, board, and issue detail routes.

## State

Issue, sequence, history, outbox in `issue_db`; React Query Issue and Project caches. The Board uses buttons rather than drag-and-drop.

## API Usage

See [issues API](../api/issues.md).

## Validation

Types/priorities/statuses, UUID links, text limits, immutable core PATCH fields, a no-op core PATCH exception, and the fixed state transition map shared by `TASK`, `BUG`, and `STORY`.

## Authorization

Visible workspace membership; `MEMBER`, `ADMIN`, and `OWNER` have equal transition access. Active Project is required for real writes. Archived-project issues remain readable, while creation, real detail changes, assignment, and transitions return `PROJECT_ARCHIVED`; the client retains reads and gates applicable write controls.

## Error Handling

Stable errors include invalid transition, archived Project, `CONCURRENT_ISSUE_MODIFICATION`, and Project unavailable. Real detail changes, assignment, and transitions require `expectedVersion`; a no-mutable-field core PATCH is visibility-only. The client refreshes relevant Issue queries after every transition result, does not optimistically fake a status, and does not retry the write.

## Important Components / Modules

Issue application service/domain/repository; Gateway issue adapter; client issue feature.

## Tests

Checked-in Issue Service domain/application/PostgreSQL lifecycle tests, Gateway transition tests, and web Issue-component/hook tests cover the fixed workflow, concurrency, atomicity, forwarding, and archived read-only gates. The PostgreSQL suite uses a dedicated disposable test database in CI.

## Known Limitations

No delete, labels, attachments, estimates, pagination, server filters, configurable workflow, transition idempotency-key guarantee, or Board drag-and-drop.

## Open Questions

Permission distinctions for issue mutations beyond membership are not implemented.
