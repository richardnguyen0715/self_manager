-- =============================================================================
-- Migration: 0001_init.sql
-- Description: Initial schema for manage-my-life productivity app
-- Tables: users, refresh_tokens, goals, projects, tasks, subtasks,
--         tags, task_tags, kanban_columns, time_blocks, focus_sessions,
--         habits, habit_logs, calendar_events, notifications,
--         analytics_events, daily_stats
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('critical', 'high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM (
        'inbox', 'planned', 'in_progress', 'waiting', 'completed', 'archived'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE goal_status AS ENUM ('active', 'completed', 'abandoned', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE project_status AS ENUM ('active', 'completed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE habit_type AS ENUM ('check', 'count', 'duration');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE habit_frequency AS ENUM ('daily', 'weekly', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE focus_mode AS ENUM ('pomodoro_25_5', 'deep_work_50_10', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM (
        'deadline_1d', 'deadline_2h', 'deadline_30m',
        'habit_reminder', 'time_block_reminder', 'goal_deadline', 'system'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    email           text            NOT NULL,
    password_hash   text            NOT NULL,
    display_name    text            NOT NULL,
    avatar_url      text,
    timezone        text            NOT NULL DEFAULT 'UTC',
    -- Pomodoro / focus preferences
    default_focus_mode  focus_mode  NOT NULL DEFAULT 'pomodoro_25_5',
    -- Notification preferences (simple flags; detailed config lives in app settings)
    notif_email_enabled     boolean NOT NULL DEFAULT true,
    notif_push_enabled      boolean NOT NULL DEFAULT true,
    notif_inapp_enabled     boolean NOT NULL DEFAULT true,
    created_at      timestamptz     NOT NULL DEFAULT now(),
    updated_at      timestamptz     NOT NULL DEFAULT now(),
    CONSTRAINT users_email_key UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ---------------------------------------------------------------------------
-- refresh_tokens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  text        NOT NULL,
    expires_at  timestamptz NOT NULL,
    revoked     boolean     NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id    ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens (expires_at)
    WHERE revoked = false;

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS goals (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title       text        NOT NULL,
    description text,
    target_date date,
    status      goal_status NOT NULL DEFAULT 'active',
    color       text,
    position    int         NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals (user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status  ON goals (user_id, status);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id          uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid            NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    goal_id     uuid            REFERENCES goals (id) ON DELETE SET NULL,
    name        text            NOT NULL,
    description text,
    color       text,
    deadline    date,
    status      project_status  NOT NULL DEFAULT 'active',
    position    int             NOT NULL DEFAULT 0,
    created_at  timestamptz     NOT NULL DEFAULT now(),
    updated_at  timestamptz     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects (user_id);
CREATE INDEX IF NOT EXISTS idx_projects_goal_id ON projects (goal_id) WHERE goal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_status  ON projects (user_id, status);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    project_id       uuid          REFERENCES projects (id) ON DELETE SET NULL,
    title            text          NOT NULL,
    description      text,
    priority         task_priority NOT NULL DEFAULT 'medium',
    status           task_status   NOT NULL DEFAULT 'inbox',
    due_date         timestamptz,
    start_date       timestamptz,
    -- time tracking (minutes)
    estimated_time   int           CHECK (estimated_time > 0),
    actual_time      int           CHECK (actual_time >= 0),
    -- iCal / RFC 5545 RRULE string, e.g. "FREQ=DAILY;INTERVAL=1"
    recurrence_rule  text,
    completed_at     timestamptz,
    position         int           NOT NULL DEFAULT 0,
    created_at       timestamptz   NOT NULL DEFAULT now(),
    updated_at       timestamptz   NOT NULL DEFAULT now()
);

-- Equality / range filters
CREATE INDEX IF NOT EXISTS idx_tasks_user_id    ON tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks (user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date   ON tasks (user_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_priority   ON tasks (user_id, priority);
-- Full-text search via trigram (requires pg_trgm)
CREATE INDEX IF NOT EXISTS idx_tasks_title_trgm ON tasks USING GIN (title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- subtasks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subtasks (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id    uuid        NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    title      text        NOT NULL,
    is_done    boolean     NOT NULL DEFAULT false,
    position   int         NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks (task_id);

-- ---------------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       text        NOT NULL,
    color      text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tags_user_name_key UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags (user_id);

-- ---------------------------------------------------------------------------
-- task_tags  (join table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_tags (
    task_id uuid NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    tag_id  uuid NOT NULL REFERENCES tags  (id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id  ON task_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_task_id ON task_tags (task_id);

-- ---------------------------------------------------------------------------
-- kanban_columns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kanban_columns (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    project_id uuid        REFERENCES projects (id) ON DELETE CASCADE,
    name       text        NOT NULL,
    -- maps to task_status so drag-drop can update task.status atomically
    maps_to_status task_status,
    position   int         NOT NULL DEFAULT 0,
    color      text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kanban_columns_user_id    ON kanban_columns (user_id);
CREATE INDEX IF NOT EXISTS idx_kanban_columns_project_id ON kanban_columns (project_id)
    WHERE project_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- time_blocks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS time_blocks (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    task_id      uuid        REFERENCES tasks (id) ON DELETE SET NULL,
    title        text        NOT NULL,
    start_time   timestamptz NOT NULL,
    end_time     timestamptz NOT NULL,
    actual_start timestamptz,
    actual_end   timestamptz,
    color        text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT time_blocks_start_before_end CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_time_blocks_user_id    ON time_blocks (user_id);
CREATE INDEX IF NOT EXISTS idx_time_blocks_task_id    ON time_blocks (task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_time_blocks_start_time ON time_blocks (user_id, start_time);

-- ---------------------------------------------------------------------------
-- focus_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS focus_sessions (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    time_block_id    uuid        REFERENCES time_blocks (id) ON DELETE SET NULL,
    mode             focus_mode  NOT NULL DEFAULT 'pomodoro_25_5',
    started_at       timestamptz NOT NULL DEFAULT now(),
    paused_at        timestamptz,
    ended_at         timestamptz,
    -- total active seconds (sum of segments minus paused durations)
    duration_seconds int         CHECK (duration_seconds >= 0),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_id       ON focus_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_time_block_id ON focus_sessions (time_block_id)
    WHERE time_block_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_focus_sessions_started_at    ON focus_sessions (user_id, started_at);

-- ---------------------------------------------------------------------------
-- habits
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS habits (
    id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid            NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name            text            NOT NULL,
    description     text,
    habit_type      habit_type      NOT NULL DEFAULT 'check',
    -- target_value: for 'count' = target count; for 'duration' = target minutes; for 'check' = 1
    target_value    numeric(10,2)   NOT NULL DEFAULT 1,
    frequency       habit_frequency NOT NULL DEFAULT 'daily',
    -- frequency_days: 0=Sun … 6=Sat; NULL when frequency='daily'
    frequency_days  int[]           CHECK (
                        frequency_days IS NULL OR
                        (array_length(frequency_days, 1) > 0 AND
                         frequency_days <@ ARRAY[0,1,2,3,4,5,6]::int[])
                    ),
    -- reminder_time: local time-of-day without timezone, e.g. '07:30:00'
    reminder_time   time,
    color           text,
    icon            text,
    archived        boolean         NOT NULL DEFAULT false,
    position        int             NOT NULL DEFAULT 0,
    created_at      timestamptz     NOT NULL DEFAULT now(),
    updated_at      timestamptz     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits (user_id);
CREATE INDEX IF NOT EXISTS idx_habits_active  ON habits (user_id, archived) WHERE archived = false;

-- ---------------------------------------------------------------------------
-- habit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS habit_logs (
    id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    habit_id  uuid        NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
    user_id   uuid        NOT NULL REFERENCES users  (id) ON DELETE CASCADE,
    log_date  date        NOT NULL,
    -- value: for 'check' = 1 or 0; for 'count'/'duration' = actual value
    value     numeric(10,2) NOT NULL DEFAULT 0,
    completed boolean     NOT NULL DEFAULT false,
    note      text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT habit_logs_habit_date_key UNIQUE (habit_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id  ON habit_logs (habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs (user_id, log_date);

-- ---------------------------------------------------------------------------
-- calendar_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_events (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title       text        NOT NULL,
    description text,
    start_time  timestamptz NOT NULL,
    end_time    timestamptz NOT NULL,
    all_day     boolean     NOT NULL DEFAULT false,
    location    text,
    color       text,
    recurrence_rule text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT calendar_events_start_before_end CHECK (end_time >= start_time)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id    ON calendar_events (user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events (user_id, start_time);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id             uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid              NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type           notification_type NOT NULL,
    title          text              NOT NULL,
    body           text,
    -- polymorphic reference: task_id / habit_id / calendar_event_id / etc.
    entity_id      uuid,
    entity_table   text,
    read           boolean           NOT NULL DEFAULT false,
    -- when the notification should fire (NULL = immediate)
    scheduled_for  timestamptz,
    sent_at        timestamptz,
    created_at     timestamptz       NOT NULL DEFAULT now(),
    updated_at     timestamptz       NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id       ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread        ON notifications (user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_for ON notifications (scheduled_for)
    WHERE sent_at IS NULL AND scheduled_for IS NOT NULL;

-- ---------------------------------------------------------------------------
-- analytics_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_events (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    event_type  text        NOT NULL,
    entity_id   uuid,
    metadata    jsonb,
    occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id     ON analytics_events (user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_occurred_at ON analytics_events (user_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type  ON analytics_events (user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_metadata    ON analytics_events USING GIN (metadata)
    WHERE metadata IS NOT NULL;

-- ---------------------------------------------------------------------------
-- daily_stats  (pre-aggregated, refreshed nightly / on-demand)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_stats (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    stat_date               date        NOT NULL,
    tasks_completed         int         NOT NULL DEFAULT 0,
    tasks_created           int         NOT NULL DEFAULT 0,
    focus_minutes           int         NOT NULL DEFAULT 0,
    -- habit_completion_rate: 0.0 – 1.0
    habit_completion_rate   numeric(5,4) NOT NULL DEFAULT 0
        CHECK (habit_completion_rate BETWEEN 0 AND 1),
    pomodoro_sessions       int         NOT NULL DEFAULT 0,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT daily_stats_user_date_key UNIQUE (user_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_user_date ON daily_stats (user_id, stat_date);

-- ---------------------------------------------------------------------------
-- updated_at auto-maintenance trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$ DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'users', 'goals', 'projects', 'tasks', 'subtasks', 'tags',
        'kanban_columns', 'time_blocks', 'focus_sessions', 'habits',
        'habit_logs', 'calendar_events', 'notifications',
        'analytics_events', 'daily_stats'
    ] LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I;
             CREATE TRIGGER trg_%s_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
            t, t, t, t
        );
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Seed: default kanban columns for every new user
-- (call this after INSERT INTO users, or use a trigger / application code)
-- Helper function usable from app layer:
--   SELECT create_default_kanban_columns('<user_uuid>');
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_default_kanban_columns(p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO kanban_columns (user_id, project_id, name, maps_to_status, position)
    VALUES
        (p_user_id, NULL, 'Inbox',       'inbox',       0),
        (p_user_id, NULL, 'To Do',        'planned',     1),
        (p_user_id, NULL, 'In Progress',  'in_progress', 2),
        (p_user_id, NULL, 'Done',         'completed',   3)
    ON CONFLICT DO NOTHING;
END;
$$;
