-- =============================================================================
-- 0014_calendar_types
--
-- Adds user-defined "calendar types" (categories) for the personal Life
-- Calendar. Each type carries shared config (colour, icon, defaults) that all
-- events of that type inherit. An event can belong to one or more types via the
-- event_calendar_types join table.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- calendar_types
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_types (
    id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name                     text        NOT NULL,
    color                    text        NOT NULL DEFAULT '#3b82f6',
    icon                     text,
    description              text,
    -- Shared config inherited by every event of this type:
    default_all_day          boolean     NOT NULL DEFAULT false,
    default_reminder_minutes integer,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_types_user
    ON calendar_types (user_id);

-- ---------------------------------------------------------------------------
-- event_calendar_types  (many-to-many: event ⇄ type)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_calendar_types (
    event_id         uuid NOT NULL REFERENCES calendar_events (id) ON DELETE CASCADE,
    calendar_type_id uuid NOT NULL REFERENCES calendar_types  (id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, calendar_type_id)
);

CREATE INDEX IF NOT EXISTS idx_event_calendar_types_event
    ON event_calendar_types (event_id);

CREATE INDEX IF NOT EXISTS idx_event_calendar_types_type
    ON event_calendar_types (calendar_type_id);
