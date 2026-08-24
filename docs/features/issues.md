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

Issue, sequence, history, outbox in `issue_db`; React Query issues cache.

## API Usage

See [issues API](../api/issues.md).

## Validation

Types/priorities/statuses, UUID links, text limits, and fixed state transition map.

## Authorization

Visible workspace membership; active project required for writes. Archived-project issues remain readable, while all Issue Core writes return `PROJECT_ARCHIVED`.

## Error Handling

Stable errors include invalid transition, archived project, `CONCURRENT_ISSUE_MODIFICATION`, and Project unavailable. Details, assignment, and transitions require `expectedVersion`; the client refreshes relevant issue queries after a concurrency conflict and does not retry the write.

## Important Components / Modules

Issue application service/domain/repository; Gateway issue adapter; client issue feature.

## Tests

No verified Issue-specific automated tests in the checked-in test set.

## Known Limitations

No delete, labels, attachments, estimates, pagination, server filters, or configurable workflow.

## Open Questions

Permission distinctions for issue mutations beyond membership are not implemented.
