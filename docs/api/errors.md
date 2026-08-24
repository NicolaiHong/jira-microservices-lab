# Errors

## Purpose

Common implemented API failure shape.

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "correlationId": "req_example",
  "details": {}
}
```

| Family | Examples |
| --- | --- |
| Validation (`400`) | `VALIDATION_ERROR` |
| Authentication (`401`) | `UNAUTHORIZED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `AUTH_CONTEXT_REQUIRED`, `INVALID_REFRESH_TOKEN` |
| Authorization/visibility (`403`/`404`) | `WORKSPACE_PERMISSION_DENIED`, `WORKSPACE_NOT_FOUND`, `PROJECT_NOT_FOUND` |
| Conflict (`409`) | `WORKSPACE_SLUG_ALREADY_EXISTS`, `PROJECT_KEY_ALREADY_EXISTS`, `PROJECT_NAME_ALREADY_EXISTS`, `WORKSPACE_MEMBER_ALREADY_EXISTS`, `LAST_WORKSPACE_OWNER`, `PROJECT_ARCHIVED`, `INVALID_ISSUE_TRANSITION`, `CONCURRENT_ISSUE_MODIFICATION` |
| Dependency (`503`) | `IAM_SERVICE_UNAVAILABLE`, `PROJECT_SERVICE_UNAVAILABLE`, `ISSUE_SERVICE_UNAVAILABLE`, `NOTIFICATION_SERVICE_UNAVAILABLE` |

Exact error values are service-defined; callers should branch on documented codes, not prose messages.
