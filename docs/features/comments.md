# Comments Feature

## Purpose

Append comments and expose issue activity.

## Related Requirements

COMMENT-001.

## Related Business Flows

[Comments and activity](../flows/comments-and-activity.md).

## Responsibilities

Issue Service writes comment/history/outbox atomically.

## UI

Issue detail page.

## State

`issue_comments`, `issue_history`, Issue version, and outbox in `issue_db`.

## API Usage

See [comments API](../api/comments.md).

## Validation

Trimmed, nonblank body, maximum 5,000 characters. PostgreSQL also rejects whitespace-only and oversized persisted bodies as defense in depth.

## Authorization

Visible membership; active project only for adding.

## Error Handling

Invalid body, archived project, and stale issue update are rejected.

## Important Components / Modules

Issue repository `addComment`, client issue detail hooks. Successful creation invalidates Issue detail, Project Issue list, comments, and history so the next Issue mutation uses the incremented version.

## Tests

No dedicated automated test verified.

## Known Limitations

Comments cannot be edited or deleted. A comment POST has no idempotency-key guarantee. The persisted `commentPreview` in an event can contain up to 160 characters of user-generated text.

## Open Questions

Whether comments should be mutable is unspecified.
