-- =============================================================================
-- Migration: 0004_links_attachments.sql
-- Adds: work_item_links, work_item_web_links, work_item_attachments
-- Idempotent: all CREATE TABLE/INDEX use IF NOT EXISTS.
-- =============================================================================

-- ── work_item_links ──────────────────────────────────────────────────────────
-- Represents a typed relationship between two work items owned by the same user.
-- Guard: target_work_item_id != work_item_id (enforced by CHECK constraint).
CREATE TABLE IF NOT EXISTS work_item_links (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    work_item_id        uuid        NOT NULL REFERENCES work_items (id) ON DELETE CASCADE,
    target_work_item_id uuid        NOT NULL REFERENCES work_items (id) ON DELETE CASCADE,
    link_type           text        NOT NULL DEFAULT 'relates_to',
    created_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_work_item_links UNIQUE (work_item_id, target_work_item_id),
    CONSTRAINT chk_work_item_links_no_self CHECK (work_item_id <> target_work_item_id)
);
CREATE INDEX IF NOT EXISTS idx_work_item_links_work_item_id ON work_item_links (work_item_id);

-- ── work_item_web_links ──────────────────────────────────────────────────────
-- External URLs attached to a work item (bookmarks, references, etc.).
CREATE TABLE IF NOT EXISTS work_item_web_links (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    work_item_id uuid        NOT NULL REFERENCES work_items (id) ON DELETE CASCADE,
    url          text        NOT NULL,
    title        text,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_work_item_web_links_work_item_id ON work_item_web_links (work_item_id);

-- ── work_item_attachments ────────────────────────────────────────────────────
-- Local-disk file uploads associated with a work item.
-- stored_path holds the filename under the uploads/ directory (not a full path).
CREATE TABLE IF NOT EXISTS work_item_attachments (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    work_item_id uuid        NOT NULL REFERENCES work_items (id) ON DELETE CASCADE,
    filename     text        NOT NULL,
    stored_path  text        NOT NULL,
    mime_type    text,
    size_bytes   bigint,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_work_item_attachments_work_item_id ON work_item_attachments (work_item_id);
