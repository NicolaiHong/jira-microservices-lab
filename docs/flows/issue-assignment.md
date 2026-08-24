# Issue Assignment Flow

## Purpose

Set or clear an issue assignee.

## Actors

Workspace members with visible active-project access.

## Preconditions

Issue exists, caller can write its active project, and the request provides a positive integer `expectedVersion`.

## Trigger

`PATCH /api/issues/{issueId}/assignee`.

## Main Flow

1. Issue Service loads visible issue and access context.
2. If supplied, assignee UUID is checked through Project Service against the issue project at mutation time.
3. Issue Service updates assignee with its expected-version compare-and-swap, records history, and stages `issue.assigned`.

## Alternative Flows

### A1 — Unassign

An omitted, null, or empty assignee value clears the assignee.

## Failure / Error Flows

Invalid UUID, inaccessible assignee, archived project, stale version, or unavailable Project Service fail.

## Business Rules

[BR-ISSUE-003](../product/business-rules.md#br-issue-003--assignment-and-links), [BR-ISSUE-004](../product/business-rules.md#br-issue-004--change-history-and-delivery-event).

## State Transitions

Issue status does not change.

## Permissions

See [permissions matrix](../reference/permissions-matrix.md).

## Data Affected

Issue assignee/version, history, outbox event.

## API Dependencies

`PATCH /api/issues/{issueId}/assignee`; Project access-context endpoint.

## UI Entry Points

Issue detail assignment form accepts a member UUID.

## Validation

Assignee is optional, but supplied value must be UUID and project-visible.

## Edge Cases

The actor may assign themselves; no contrary rule is implemented. A later workspace removal does not erase an existing historical `assigneeUserId`; it only blocks future assignments of that user.

## Acceptance Criteria

### AC-ISSUE-ASSIGN-001

Given a valid project member assignee, when a member assigns an issue, then the issue records the assignee and an assignment history/event.

## Related Documentation

[issues API](../api/issues.md), [notification flow](notification.md).
