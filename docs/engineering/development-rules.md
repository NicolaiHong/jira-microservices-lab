# Development Rules

## Purpose

Rules for changes in this repository.

1. Read applicable requirements, business rules, architecture, flow, and feature docs before implementation.
2. Do not invent business rules or silently expand scope; label missing behaviour `OPEN QUESTION`.
3. Implement the smallest vertical slice that meets a documented requirement.
4. Keep services within their ownership boundaries and preserve correlation IDs.
5. Run focused builds/tests for changed services and update documentation with behaviour/contract changes.
6. Report implementation/documentation/test conflicts before changing architecture.
7. Create an ADR for architecture, cross-service contract, data-ownership, or transport changes.
