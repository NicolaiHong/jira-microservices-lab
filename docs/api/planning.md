# Planning API

## Purpose

Epics and sprints owned by Issue Service.

| Method/path | Authorization | Request | Success | Validation/errors | Requirement |
| --- | --- | --- | --- | --- | --- |
| `GET/POST /api/projects/{projectId}/epics` | Member; active project for POST | POST name, color?, startDate?, targetDate? | `200 { items }` / `201 { epic }` | color/date/name | PLAN-001 |
| `PATCH /api/epics/{epicId}` | Member, active project | name?, color?, startDate?, targetDate? | `200 { epic }` | color/date/name | PLAN-001 |
| `GET/POST /api/projects/{projectId}/sprints` | Member; active project for POST | POST name, goal?, startDate?, endDate? | `200 { items }` / `201 { sprint }` | one active sprint, date/name | PLAN-001 |
| `POST /api/sprints/{sprintId}/complete` | Member, active project | — | `200 { sprint }` | active sprint only | PLAN-001 |

Valid epic colors: `PURPLE`, `BLUE`, `GREEN`, `YELLOW`, `ORANGE`. Sprints begin `ACTIVE`; completion makes them `COMPLETED`.
