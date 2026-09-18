-- Outbox retries back off per event and keep the last delivery error; events
-- that exhaust their attempts remain in the table for health reporting.
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP INDEX IF EXISTS ix_outbox_events_pending;
CREATE INDEX IF NOT EXISTS ix_outbox_events_due
    ON outbox_events(next_attempt_at, occurred_at)
    WHERE published_at IS NULL;
