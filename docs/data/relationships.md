# Relationships

## Purpose

Verified entity relationships. Solid arrows are database foreign keys within an owner; dotted arrows are external IDs/contracts.

```mermaid
erDiagram
  WORKSPACE ||--o{ WORKSPACE_MEMBER : has
  WORKSPACE ||--o{ PROJECT : contains
  PROJECT ||--o{ ISSUE : owns_by_external_id
  ISSUE ||--o{ ISSUE_COMMENT : has
  ISSUE ||--o{ ISSUE_HISTORY : records
  PROJECT ||--o{ EPIC : has
  PROJECT ||--o{ SPRINT : has
  EPIC o|--o{ ISSUE : groups
  SPRINT o|--o{ ISSUE : schedules
```

User IDs in `project_db` and `issue_db` are external IAM references. Issue `project_id` is an external Project identifier, checked through HTTP. The diagram intentionally omits cross-service foreign keys because they do not exist.
