-- =============================================================================
-- Migration: 0006_board_columns.sql
-- Adds user-defined board columns to replace the hardcoded status-based board.
-- Idempotent: CREATE TABLE/INDEX use IF NOT EXISTS; ALTER TABLE uses IF NOT EXISTS.
-- NOTE: The existing work_item_status enum is NOT changed; this is purely additive.
-- =============================================================================

-- ── board_columns ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS board_columns (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id     uuid        REFERENCES projects(id) ON DELETE CASCADE,   -- NULL = "All projects" board
    name           text        NOT NULL,
    color          text,
    position       int         NOT NULL DEFAULT 0,
    wip_limit      int,
    mapped_status  work_item_status,   -- seeded defaults map to an enum value; custom columns are NULL
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_columns_user_project_pos
    ON board_columns (user_id, project_id, position);

-- ── work_items: add column_id ─────────────────────────────────────────────────
ALTER TABLE work_items
    ADD COLUMN IF NOT EXISTS column_id uuid REFERENCES board_columns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_work_items_column_id ON work_items (column_id);
