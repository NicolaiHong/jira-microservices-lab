# Projects Feature

## Purpose

Workspace-scoped project lifecycle.

## Related Requirements

PROJ-001.

## Related Business Flows

[Project management](../flows/project-management.md).

## Responsibilities

Project Service owns project values/status and provides access context to Issue.

## UI

`/projects` lists/creates projects; project pages use a project ID route.

## State

`projects` in `project_db`.

## API Usage

See [projects API](../api/projects.md).

## Validation

Names are trimmed and unique case-insensitively within a workspace; keys are trimmed, uppercased ASCII letters/numbers, and unique within a workspace. Name/key limits are 120/20; description limit is 2,000.

## Authorization

Members read; owners/admins manage.

## Error Handling

Non-members see not found; archived updates conflict with `PROJECT_ARCHIVED`. PATCH is presence-aware: omitted fields are retained, null/blank descriptions clear, and `{}` is a read/no-op.

## Important Components / Modules

Project lifecycle use cases, Gateway project adapter, client project feature.

## Tests

Project domain tests verify archive semantics.

## Known Limitations

No restore/delete; no management UI for update/archive.

## Open Questions

None beyond unimplemented lifecycle options.
