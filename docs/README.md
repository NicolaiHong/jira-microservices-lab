# Documentation

## Purpose

This directory is the repository's business and architecture source of truth. Content is **VERIFIED** against the implementation unless labelled **OPEN QUESTION**.

| Need | Source of truth |
| --- | --- |
| Product intent and acceptance criteria | [product](product/) |
| Business process behaviour | [flows](flows/) |
| Capability-to-code mapping | [features](features/) |
| System design and boundaries | [architecture](architecture/) |
| HTTP and event contracts | [api](api/) and [`contracts/events`](../contracts/events/) |
| Persistence | [data](data/) |
| Architectural rationale | [decisions](decisions/) |
| Developer workflow | [engineering](engineering/) |
| Exact lookup facts | [reference](reference/) |

Start with [product/scope.md](product/scope.md), [product/requirements.md](product/requirements.md), and [architecture/overview.md](architecture/overview.md). Read the relevant flow and feature page before changing a capability.

## Evidence policy

Implementation, migrations, route declarations, and tests are the primary evidence. The old weekly notes and earlier documentation were retired because they mixed plans with facts and did not cover the current services. Do not infer a behaviour merely because it is common in Jira.
