# Diagrams

## Purpose

Evolvable diagrams live as Mermaid in the relevant canonical pages: [architecture overview](../architecture/overview.md), [data flow](../architecture/data-flow.md), [relationships](../data/relationships.md), and [issue lifecycle](../flows/issue-lifecycle.md).

The repository-level [`diagrams/`](../../diagrams/) directory holds the Draw.io source and its exports:

| File | Content |
| --- | --- |
| `service-communication.drawio` | Source for both pages below |
| `service-communication.png` / `.svg` | Page 1 — service topology, internal HTTP calls, data ownership, Redis and Kafka |
| `issue-event-flow.png` | Page 2 — Outbox → `issue.events.v1` → Notification consumer, recipient access recheck, DLQ and offset commit |

After editing the source, re-export with the Draw.io desktop CLI (`-p` is 1-based):

```bash
draw.io -x -f png -p 1 -o service-communication.png service-communication.drawio
draw.io -x -f svg -p 1 -o service-communication.svg service-communication.drawio
draw.io -x -f png -p 2 -o issue-event-flow.png service-communication.drawio
```
