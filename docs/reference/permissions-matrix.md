# Permissions Matrix

## Purpose

Exact authorization lookup for verified API behaviour.

| Action | Unauthenticated | MEMBER membership | ADMIN membership | OWNER membership |
| --- | --- | --- | --- | --- |
| Register/login | Yes | — | — | — |
| List own workspaces | No | Yes | Yes | Yes |
| Create workspace | No | Yes | Yes | Yes |
| Read workspace projects | No | Yes | Yes | Yes |
| Create/update/archive project | No | No | Yes | Yes |
| Add/change/remove non-owner member | No | No | Yes | Yes |
| Grant/change/remove owner role | No | No | No | Yes |
| Create/read/change/assign/transition/comment issue | No | Yes, active project for writes | Yes, active project for writes | Yes, active project for writes |
| Manage epics/sprints | No | Yes, active project for writes | Yes, active project for writes | Yes, active project for writes |
| Read/mark notifications | No | Own only | Own only | Own only |

Non-members receive not-found responses for workspace/project visibility checks. API-level membership management exists; the web client currently has no verified management screen.
