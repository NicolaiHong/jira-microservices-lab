# Status Transition Flow

## Purpose

Move an issue through the fixed workflow.

## Actors

Workspace members with visible active-project access.

## Preconditions

Issue exists, project is active, requested status is a valid next state, and the request provides a positive integer `expectedVersion`.

## Trigger

`POST /api/issues/{issueId}/transitions`.

## Main Flow

1. Issue Service checks visibility/write access.
2. It normalizes and validates requested status.
3. It enforces the fixed transition map and performs the expected-version compare-and-swap update.
4. It writes `STATUS_CHANGED` history and `issue.transitioned` outbox event.

## Alternative Flows

None verified.

## Failure / Error Flows

Same state or invalid next state returns `INVALID_ISSUE_TRANSITION`; stale writes return `CONCURRENT_ISSUE_MODIFICATION`.

## Business Rules

[BR-STATUS-001](../product/business-rules.md#br-status-001--fixed-status-transitions).

## State Transitions

See [status reference](../reference/status-reference.md).

## Permissions

See [permissions matrix](../reference/permissions-matrix.md).

## Data Affected

Issue status/version, history, outbox event.

## API Dependencies

`POST /api/issues/{issueId}/transitions`.

## UI Entry Points

Board cards invoke status transitions.

## Validation

Status must be `TODO`, `IN_PROGRESS`, or `DONE` and be a permitted next state.

## Edge Cases

`DONE` can reopen only to `IN_PROGRESS`, not directly to `TODO`.

## Acceptance Criteria

### AC-STATUS-001

Given an `IN_PROGRESS` issue, when a member selects `DONE`, then it is transitioned and notification recipients are derived asynchronously.

## Related Documentation

[issue lifecycle](issue-lifecycle.md), [notifications](notification.md).
