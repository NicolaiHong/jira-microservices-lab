# Database Guidelines

## Purpose

Engineering rules for persistence changes.

- Each service owns and migrates its own schema; changes use Flyway (IAM), EF Core migrations (Project), or checked-in SQL migrations (Issue).
- Use UUIDs for externally referenced identities and enforce business uniqueness with indexes/constraints.
- Use local transactions for multi-step writes. Do not use a distributed transaction across service stores.
- Preserve the Issue transaction that writes state, history, and outbox event together.
- Store only password/refresh-token hashes; do not introduce raw secret persistence.
- Cross-service references are IDs validated through contracts, not foreign keys.
- Treat Redis notification data as an expiring projection, not canonical issue/account history.
