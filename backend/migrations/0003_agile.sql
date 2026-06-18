-- =============================================================================
-- Migration: 0003_agile.sql — Personal Agile OS (additive)
-- Adds: initiatives, epics, sprints, work_items, work_item_subtasks,
--       sprint_reviews, retrospectives. Alters time_blocks. Backfills tasks.
-- Idempotent: all CREATE TABLE/INDEX use IF NOT EXISTS; enums guarded by DO$$
-- =============================================================================

-- ── Enums (plain Postgres enums; services cast ::text) ──────────────────────
DO $$ BEGIN
    CREATE TYPE initiative_status AS ENUM ('active', 'completed', 'paused', 'abandoned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE epic_status AS ENUM ('todo', 'in_progress', 'done', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE sprint_status AS ENUM ('planned', 'active', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE work_item_type AS ENUM ('story', 'task', 'bug', 'habit', 'milestone');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE work_item_status AS ENUM ('backlog', 'todo', 'in_progress', 'review', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── initiatives ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS initiatives (
    id          uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid              NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    goal_id     uuid              NOT NULL REFERENCES goals (id) ON DELETE CASCADE,
    title       text              NOT NULL,
    description text,
    status      initiative_status NOT NULL DEFAULT 'active',
    color       text,
    position    int               NOT NULL DEFAULT 0,
    created_at  timestamptz       NOT NULL DEFAULT now(),
    updated_at  timestamptz       NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_initiatives_user_id ON initiatives (user_id);
CREATE INDEX IF NOT EXISTS idx_initiatives_goal_id ON initiatives (goal_id);

-- ── epics ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS epics (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    initiative_id uuid        NOT NULL REFERENCES initiatives (id) ON DELETE CASCADE,
    title         text        NOT NULL,
    description   text,
    status        epic_status NOT NULL DEFAULT 'todo',
    start_date    date,
    due_date      date,
    color         text,
    position      int         NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_epics_user_id       ON epics (user_id);
CREATE INDEX IF NOT EXISTS idx_epics_initiative_id ON epics (initiative_id);

-- ── sprints ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sprints (
    id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name             text          NOT NULL,
    goal_text        text,
    start_date       date          NOT NULL,
    end_date         date          NOT NULL,
    capacity_points  int           NOT NULL DEFAULT 0 CHECK (capacity_points >= 0),
    status           sprint_status NOT NULL DEFAULT 'planned',
    velocity         numeric(5,2),
    completed_points int           NOT NULL DEFAULT 0 CHECK (completed_points >= 0),
    created_at       timestamptz   NOT NULL DEFAULT now(),
    updated_at       timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT sprints_start_before_end CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_sprints_user_id ON sprints (user_id);
CREATE INDEX IF NOT EXISTS idx_sprints_status  ON sprints (user_id, status);
-- At most one active sprint per user:
CREATE UNIQUE INDEX IF NOT EXISTS uq_sprints_one_active
    ON sprints (user_id) WHERE status = 'active';

-- ── work_items ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_items (
    id              uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid             NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    epic_id         uuid             REFERENCES epics (id)   ON DELETE SET NULL,
    sprint_id       uuid             REFERENCES sprints (id) ON DELETE SET NULL,
    type            work_item_type   NOT NULL DEFAULT 'task',
    title           text             NOT NULL,
    description     text,
    status          work_item_status NOT NULL DEFAULT 'backlog',
    priority        task_priority    NOT NULL DEFAULT 'medium',
    story_points    int              CHECK (story_points IS NULL OR story_points IN (1,3,5,8)),
    position        int              NOT NULL DEFAULT 0,
    due_date        timestamptz,
    recurrence_rule text,
    completed_at    timestamptz,
    created_at      timestamptz      NOT NULL DEFAULT now(),
    updated_at      timestamptz      NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_work_items_user_id    ON work_items (user_id);
CREATE INDEX IF NOT EXISTS idx_work_items_epic_id    ON work_items (epic_id)   WHERE epic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_items_sprint_id  ON work_items (sprint_id) WHERE sprint_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_items_backlog    ON work_items (user_id)   WHERE sprint_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_work_items_status     ON work_items (user_id, status);
CREATE INDEX IF NOT EXISTS idx_work_items_due_date   ON work_items (user_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_items_title_trgm ON work_items USING GIN (title gin_trgm_ops);

-- ── work_item_subtasks ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_item_subtasks (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    work_item_id uuid        NOT NULL REFERENCES work_items (id) ON DELETE CASCADE,
    title        text        NOT NULL,
    is_done      boolean     NOT NULL DEFAULT false,
    position     int         NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_work_item_subtasks_work_item_id ON work_item_subtasks (work_item_id);

-- ── sprint_reviews ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sprint_reviews (
    id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    sprint_id        uuid         NOT NULL REFERENCES sprints (id) ON DELETE CASCADE,
    planned_points   int          NOT NULL DEFAULT 0,
    completed_points int          NOT NULL DEFAULT 0,
    velocity         numeric(5,2) NOT NULL DEFAULT 0,
    summary          text,
    created_at       timestamptz  NOT NULL DEFAULT now(),
    updated_at       timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_sprint_reviews_sprint UNIQUE (sprint_id)
);
CREATE INDEX IF NOT EXISTS idx_sprint_reviews_user_id ON sprint_reviews (user_id);

-- ── retrospectives ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS retrospectives (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    sprint_id    uuid        NOT NULL REFERENCES sprints (id) ON DELETE CASCADE,
    went_well    text,
    went_wrong   text,
    action_items jsonb       NOT NULL DEFAULT '[]'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_retrospectives_sprint UNIQUE (sprint_id)
);
CREATE INDEX IF NOT EXISTS idx_retrospectives_user_id ON retrospectives (user_id);

-- ── ALTER time_blocks: add work_item_id (keep task_id) ──────────────────────
ALTER TABLE time_blocks
    ADD COLUMN IF NOT EXISTS work_item_id uuid REFERENCES work_items (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_time_blocks_work_item_id
    ON time_blocks (work_item_id) WHERE work_item_id IS NOT NULL;

-- ── Backfill: existing tasks → work_items (type='task') ─────────────────────
-- Map legacy task_status → work_item_status:
--   inbox|planned|waiting → backlog ; in_progress → in_progress ;
--   completed → done ; archived → done.
-- Shared UUID keeps time_blocks.task_id aligned for future repointing.
INSERT INTO work_items (
    id, user_id, epic_id, sprint_id, type, title, description,
    status, priority, story_points, position, due_date, recurrence_rule,
    completed_at, created_at, updated_at
)
SELECT
    t.id,
    t.user_id,
    NULL,
    NULL,
    'task'::work_item_type,
    t.title,
    t.description,
    (CASE t.status::text
        WHEN 'in_progress' THEN 'in_progress'
        WHEN 'completed'   THEN 'done'
        WHEN 'archived'    THEN 'done'
        ELSE 'backlog'
     END)::work_item_status,
    t.priority,   -- task_priority reused as-is
    NULL,         -- story_points unestimated
    t.position,
    t.due_date,
    t.recurrence_rule,
    t.completed_at,
    t.created_at,
    t.updated_at
FROM tasks t
ON CONFLICT (id) DO NOTHING;

-- ── updated_at triggers for new tables ──────────────────────────────────────
DO $$ DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'initiatives','epics','sprints','work_items','work_item_subtasks',
        'sprint_reviews','retrospectives'
    ] LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I;
             CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t, t, t);
    END LOOP;
END $$;
