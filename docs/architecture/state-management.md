# State Management

## Purpose

Identify authoritative state and browser state.

| State | Owner | Notes |
| --- | --- | --- |
| Accounts and sessions | IAM / `iam_db` | Access token is issued by IAM; refresh raw token is an HttpOnly gateway cookie. |
| Memberships and projects | Project / `project_db` | Authorization source for workspace/project context. |
| Issues/planning/history/outbox | Issue / `issue_db` | Local transactions keep an issue change, history, and outbox event together. |
| Notifications | Notification / Redis | Derived, expiring 90-day recipient projection. |
| Browser server state | React Query | Refetched after mutations. |
| Browser session/filter state | Zustand and localStorage | Access token is persisted in localStorage; this implementation choice is a security consideration. |
