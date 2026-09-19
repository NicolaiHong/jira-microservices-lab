-- Supports the claim query's per-aggregate ordering check (ADR 0004): an event
-- is claimable only when no earlier unpublished version of its aggregate exists.
CREATE INDEX IF NOT EXISTS ix_outbox_events_unpublished_aggregate
    ON outbox_events(aggregate_id, aggregate_version)
    WHERE published_at IS NULL;
