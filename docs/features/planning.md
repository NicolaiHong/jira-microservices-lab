# Planning Feature

## Purpose

Project epics, sprints, roadmap, and issue planning links.

## Related Requirements

PLAN-001.

## Related Business Flows

[Planning](../flows/planning.md).

## Responsibilities

Issue Service owns epics/sprints and validates issue links.

## UI

Backlog reads planning records; roadmap creates epics.

## State

`epics`, `sprints`, optional Issue `epic_id`/`sprint_id` in `issue_db`.

## API Usage

See [planning API](../api/planning.md).

## Validation

Colors, date ordering, text limits, one active sprint, project-local links.

## Authorization

Visible membership; active project for writes.

## Error Handling

Archived, invalid date/link, existing active sprint, and repeat completion errors.

## Important Components / Modules

Planning application service/repository and client backlog/roadmap.

## Tests

No dedicated automated test verified.

## Known Limitations

No sprint-management UI or issue move behaviour upon completion.

## Open Questions

Backlog/sprint semantics after sprint completion are not specified.
