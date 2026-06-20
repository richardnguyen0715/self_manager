-- =============================================================================
-- Migration: 0009_workitem_details.sql
-- Adds: start_date, labels, github_repo, github_branch, github_pr columns to
--       work_items; creates work_item_comments table.
-- Idempotent: ALTER uses IF NOT EXISTS; CREATE TABLE/INDEX use IF NOT EXISTS.
-- =============================================================================

-- ── work_items: new columns ──────────────────────────────────────────────────
ALTER TABLE work_items
    ADD COLUMN IF NOT EXISTS start_date    timestamptz,
    ADD COLUMN IF NOT EXISTS labels        text[]      NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS github_repo   text,
    ADD COLUMN IF NOT EXISTS github_branch text,
    ADD COLUMN IF NOT EXISTS github_pr     text;

-- ── work_item_comments ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_item_comments (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    work_item_id uuid        NOT NULL REFERENCES work_items (id) ON DELETE CASCADE,
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    body         text        NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_item_comments_work_item_id
    ON work_item_comments (work_item_id);
