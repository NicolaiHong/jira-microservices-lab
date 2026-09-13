# Comments and Activity Flow

## Purpose

Capture discussion and audit-like issue activity.

## Actors

Workspace members with visible issue-project access.

## Preconditions

Issue is visible; active project required to add a comment.

## Trigger

Add comment or list comments/history request.

## Main Flow

1. Issue Service resolves visible issue through Project access context.
2. On comment creation, it trims text, rejects blank and over-5,000-character input, and version-updates the issue once.
3. It atomically creates exactly one comment, `COMMENT_ADDED` history record referencing its comment ID, and `issue.commented` outbox event in the same PostgreSQL transaction as the Issue version increment.
4. Readers retrieve comments/history oldest first using deterministic creation-time and ID ordering.

## Alternative Flows

None verified; editing/deleting comments is not implemented.

## Failure / Error Flows

Blank/oversized body, archived project write, invisible issue, stale issue, or unavailable Project Service fail. A failed local persistence step rolls back the Issue version, comment, history, and outbox effects together.

## Business Rules

[BR-ISSUE-004](../product/business-rules.md#br-issue-004--change-history-and-delivery-event).

## State Transitions

Commenting does not change issue status, but increments issue version. A `DONE` Issue remains commentable while its Project is active.

## Permissions

See [permissions matrix](../reference/permissions-matrix.md).

## Data Affected

Issue comment, issue version, history, outbox event.

## API Dependencies

`POST/GET /api/issues/{issueId}/comments`, `GET /api/issues/{issueId}/history`.

## UI Entry Points

Issue detail page comments and history panels.

## Validation

Comment body is trimmed, required after trimming, and maximum 5,000 characters. Application validation is authoritative; PostgreSQL constraints provide defense in depth.

## Edge Cases

The history records server actions; comments have no implemented edit/delete lifecycle. A comment POST has no idempotency key and is never automatically retried after business execution uncertainty. Existing Gateway-first authentication refresh/replay remains separate from business mutation retry.

## Acceptance Criteria

### AC-COMMENT-001

Given a visible active-project issue, when a member adds a valid comment, then the comment and matching history/event are persisted together.

## Related Documentation

[comments API](../api/comments.md), [notification flow](notification.md).
