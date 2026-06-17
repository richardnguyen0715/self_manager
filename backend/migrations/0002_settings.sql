-- =============================================================================
-- Migration: 0002_settings.sql
-- Description: User preferences and browser push subscriptions tables
-- Tables: user_preferences, push_subscriptions
-- =============================================================================

-- ---------------------------------------------------------------------------
-- user_preferences
-- ---------------------------------------------------------------------------
-- Stores per-user appearance settings and structured notification preferences.
-- One row per user (1-1 with users).
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id             uuid        PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,

    -- Appearance
    theme               text        NOT NULL DEFAULT 'system'
                            CHECK (theme IN ('light', 'dark', 'system')),
    color_theme         text        NOT NULL DEFAULT 'zinc'
                            CHECK (color_theme IN ('zinc', 'slate', 'blue', 'green', 'rose', 'orange')),
    compact_mode        boolean     NOT NULL DEFAULT false,
    show_completed_tasks boolean    NOT NULL DEFAULT true,
    week_starts_on      smallint    NOT NULL DEFAULT 1
                            CHECK (week_starts_on IN (0, 1)),

    -- Notification preferences stored as a JSONB document for flexibility.
    -- Expected shape (see settings/models.rs NotificationPrefsData):
    -- {
    --   "deadline_reminder_channels": ["in_app"],
    --   "habit_reminder_channels":    ["in_app"],
    --   "time_block_reminder_channels": ["in_app"],
    --   "deadline_reminder_offsets":  [1440, 120, 30],
    --   "habit_reminder_time":        "08:00"
    -- }
    notification_prefs  jsonb       NOT NULL DEFAULT '{}',

    locale              text        NOT NULL DEFAULT 'en',
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- push_subscriptions
-- ---------------------------------------------------------------------------
-- Stores Web Push (RFC 8030) subscription objects per browser/device.
-- A user may have multiple active subscriptions (different devices/browsers).
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- The push service URL; unique so we don't store duplicate subs.
    endpoint    text        NOT NULL,
    -- ECDH public key (base64url) from PushSubscription.getKey('p256dh').
    p256dh      text        NOT NULL,
    -- Authentication secret (base64url) from PushSubscription.getKey('auth').
    auth        text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger for user_preferences
-- ---------------------------------------------------------------------------
DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON user_preferences;
    CREATE TRIGGER trg_user_preferences_updated_at
        BEFORE UPDATE ON user_preferences
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN undefined_function THEN
    -- set_updated_at() may not exist in standalone test environments; skip.
    NULL;
END $$;
