# UI Routes

## Purpose

Implemented Next.js entry points, not planned navigation.

| Route | Capability |
| --- | --- |
| `/login` | Login |
| `/register` | Registration |
| `/projects` | Workspace selection, workspace creation, project listing/creation |
| `/projects/{projectId}/backlog` | Issues, epics, sprints, create issue |
| `/projects/{projectId}/board` | Status board and status/priority client filters |
| `/projects/{projectId}/issues/{issueId}` | Issue details, edit, assignment, comments, history |
| `/projects/{projectId}/roadmap` | Epic roadmap and create epic |

The project label displayed on project pages is currently static UI copy (`Orbit Launch`) rather than loaded project metadata. This is a known UI limitation.
