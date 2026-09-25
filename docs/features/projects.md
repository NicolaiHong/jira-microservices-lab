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

`/projects` lists and creates projects; project pages use a project ID route. For owners and admins, each active project card offers:

- **Edit** — name and description. The PATCH carries only changed fields, and an emptied description is sent as `null`. The key is not editable.
- **Archive** — `DELETE` after a confirmation that states archiving cannot be undone.

Archived projects show an `Archived` badge and stay readable, with no edit or archive control. Controls are hidden by workspace role; Project Service remains the authority. Rejections such as `403`, `409 PROJECT_ARCHIVED`, a duplicate name, or a validation error appear as an error toast, and the project list and detail are refetched after every update or archive attempt.

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

Project domain tests verify archive semantics. Web client tests cover role-gated controls, PATCH payloads, archive confirmation, and conflict display.

## Known Limitations

No restore or permanent delete: an archived project cannot return to `ACTIVE`.

## Open Questions

None beyond unimplemented lifecycle options.
