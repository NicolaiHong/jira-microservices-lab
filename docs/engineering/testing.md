# Testing

## Purpose

Expected verification for a vertical slice.

| Layer | Verify |
| --- | --- |
| Domain/use case | Invariants, roles, state transitions, lifecycle rules |
| Persistence | Migrations, constraints, uniqueness, transaction/concurrency behaviour |
| HTTP | Validation, authorization, error mapping, correlation propagation |
| Contract | Gateway-service and event envelope compatibility |
| End-to-end | A gateway-routed business flow plus relevant event projection |

**VERIFIED limitation:** the checked-in test surface is sparse and `.gitignore` currently excludes test paths. Do not represent current coverage as a release gate until tracking/CI policy is fixed.
