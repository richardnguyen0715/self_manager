-- =============================================================================
-- Migration: 0005_project_scope.sql
-- Adds project_id scoping to work_items and sprints.
-- Idempotent: all ALTER TABLE ... ADD COLUMN IF NOT EXISTS;
--             CREATE INDEX ... IF NOT EXISTS.
-- =============================================================================

-- ── work_items: add project_id column ────────────────────────────────────────
ALTER TABLE work_items
    ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_work_items_project_id ON work_items (project_id);

-- ── sprints: add project_id column ───────────────────────────────────────────
ALTER TABLE sprints
    ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON sprints (project_id);

-- ── Best-effort backfill: copy project_id from tasks where titles match ───────
-- Safe no-op if the tasks table is empty or no title/user matches are found.
UPDATE work_items wi
SET project_id = t.project_id
FROM tasks t
WHERE wi.project_id IS NULL
  AND t.project_id  IS NOT NULL
  AND t.user_id     = wi.user_id
  AND t.title       = wi.title;
