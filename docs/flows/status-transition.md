# Status Transition Flow

## Purpose

Move an issue through the fixed workflow.

## Actors

Workspace `MEMBER`, `ADMIN`, and `OWNER` memberships with visible active-project access. They have equal transition permissions.

## Preconditions

Issue exists, Project is active, requested status is a valid next state, and the request provides a positive safe-integer `expectedVersion`.

## Trigger

`POST /api/issues/{issueId}/transitions`.

## Main Flow

1. Issue Service validates request/body shape and normalizes/validates the requested status.
2. It checks Project visibility and active write state; non-members retain not-found concealment and archived Projects return `PROJECT_ARCHIVED`.
3. It validates `expectedVersion`, checks the loaded version, and validates the fixed graph. The domain issues a validated transition value; the repository accepts only that value.
4. It performs the authoritative PostgreSQL compare-and-swap (`WHERE id = issueId AND version = expectedVersion`).
5. In the same local transaction, it writes exactly one `STATUS_CHANGED` history row and exactly one `issue.transitioned` outbox event.

## Alternative Flows

None verified.

## Failure / Error Flows

The precedence is: (1) body/status input validation, (2) Project access and writable state, (3) expected-version validation/conflict, then (4) graph legality. Invalid or missing status returns `400 VALIDATION_ERROR`; archived Project returns `409 PROJECT_ARCHIVED`; stale version returns `409 CONCURRENT_ISSUE_MODIFICATION`; a current-version illegal edge or same state returns `409 INVALID_ISSUE_TRANSITION`. A failed or stale transition creates no status/version/history/outbox side effects and is not retried.

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

Status must be `TODO`, `IN_PROGRESS`, or `DONE` and be a permitted next state. `expectedVersion` must be a positive safe integer.

## Edge Cases

`DONE` can reopen only to `IN_PROGRESS`, not directly to `TODO`; it is not a terminal state. Transitions have no idempotency-key guarantee. Outbox publication is asynchronous and at-least-once after the exact-one local commit.

## Acceptance Criteria

### AC-STATUS-001

Given an `IN_PROGRESS` issue, when a member selects `DONE`, then it is transitioned and notification recipients are derived asynchronously.

## Related Documentation

[issue lifecycle](issue-lifecycle.md), [notifications](notification.md).
