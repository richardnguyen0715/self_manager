-- =============================================================================
-- 0015_event_excluded_dates
--
-- Per-occurrence exceptions for recurring calendar events. Each entry is the
-- RFC-3339 start instant of an occurrence that should be skipped ("delete only
-- this instance"). "Delete this and future" is handled by setting an UNTIL on
-- the recurrence_rule instead.
-- =============================================================================

ALTER TABLE calendar_events
    ADD COLUMN IF NOT EXISTS excluded_dates text[] NOT NULL DEFAULT '{}';
