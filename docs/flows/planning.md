# Planning Flow

## Purpose

Manage project epics and sprints and link an issue to them.

## Actors

Workspace members with visible project access.

## Preconditions

Project is active for planning writes.

## Trigger

Create/list/update epic, create/list/complete sprint, or issue creation with planning links.

## Main Flow

1. Issue Service validates project access through Project Service.
2. It validates name, allowed color/dates, or sprint dates.
3. It persists the planning record in `issue_db`.
4. Issue creation validates referenced epic/project and active sprint/project match.

## Alternative Flows

### A1 — Complete sprint

An `ACTIVE` sprint becomes `COMPLETED`; completion cannot repeat.

## Failure / Error Flows

Archived project, invalid date range/color, second active sprint, nonexistent/cross-project epic/sprint, completed sprint link, and repeat completion fail.

## Business Rules

[BR-PLAN-001](../product/business-rules.md#br-plan-001--one-active-sprint), [BR-ISSUE-003](../product/business-rules.md#br-issue-003--assignment-and-links).

## State Transitions

Sprint: `ACTIVE → COMPLETED`; no reopen endpoint.

## Permissions

All workspace memberships can perform verified planning actions on an active visible project.

## Data Affected

`epics`, `sprints`, and optional Issue foreign keys in `issue_db`.

## API Dependencies

`GET/POST /api/projects/{projectId}/epics`, `PATCH /api/epics/{epicId}`, `GET/POST /api/projects/{projectId}/sprints`, `POST /api/sprints/{sprintId}/complete`.

## UI Entry Points

Backlog reads epics/sprints; roadmap creates epics; **OPEN QUESTION:** no verified sprint-management screen is present.

## Validation

Epic/sprint name maximum 120; epic color enumerated; optional goal maximum 500; date start must not follow end/target.

## Edge Cases

Database enforces one active sprint per project; the code does not automatically move issues when a sprint completes.

## Acceptance Criteria

### AC-PLAN-001

Given an active visible project, when a member creates a sprint, then it is active only if no other active sprint exists for that project.

## Related Documentation

[planning API](../api/planning.md), [planning feature](../features/planning.md).
