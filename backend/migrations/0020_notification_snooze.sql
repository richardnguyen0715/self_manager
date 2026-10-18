-- Notification snooze: a snoozed notification is hidden from the default
-- inbox and from the unread badge until `snoozed_until` passes.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_notifications_snoozed
    ON notifications (user_id, snoozed_until) WHERE snoozed_until IS NOT NULL;
