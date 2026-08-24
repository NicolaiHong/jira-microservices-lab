# Repository Structure

## Purpose

Map top-level repository areas to responsibilities.

| Path | Responsibility |
| --- | --- |
| `apps/` | Independently deployable gateway, services, and web client |
| `contracts/` | Versioned shared transport contracts, including issue events |
| `infra/docker-compose/` | Local multi-service runtime and database initialization |
| `docs/` | Canonical product, architecture, contract, and workflow documentation |
| `scripts/` | Health, smoke, and CodeGraphContext helpers |
| `tests/` | Focused cross-project tests currently present |
| `diagrams/` | Existing source/image diagrams; see `docs/diagrams/README.md` |
