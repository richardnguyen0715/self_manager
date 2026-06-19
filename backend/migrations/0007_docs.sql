-- =============================================================================
-- Migration: 0007_docs.sql
-- Confluence-style Docs: spaces, pages (tree), page_versions, page_comments.
-- Additive. status/kind stored as text+CHECK (enum-as-text convention).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── spaces ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spaces (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    project_id  uuid                 REFERENCES projects(id) ON DELETE SET NULL,
    name        text        NOT NULL,
    icon        text,
    description text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spaces_user        ON spaces (user_id);
CREATE INDEX IF NOT EXISTS idx_spaces_user_project ON spaces (user_id, project_id);

-- ── pages (self-referential tree) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pages (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id     uuid        NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    parent_id    uuid                 REFERENCES pages(id)  ON DELETE CASCADE,
    user_id      uuid        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    title        text        NOT NULL DEFAULT 'Untitled',
    kind         text        NOT NULL DEFAULT 'page'
                     CHECK (kind IN ('page', 'whiteboard')),
    content      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    excalidraw   jsonb,
    status       text        NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'published')),
    position     int         NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_pages_space          ON pages (space_id);
CREATE INDEX IF NOT EXISTS idx_pages_space_parent_pos
    ON pages (space_id, parent_id, position);
CREATE INDEX IF NOT EXISTS idx_pages_user           ON pages (user_id);
-- Fuzzy title search (pg_trgm GIN), powers GET /api/pages/search?q=
CREATE INDEX IF NOT EXISTS idx_pages_title_trgm
    ON pages USING gin (title gin_trgm_ops);

-- ── page_versions (snapshot history) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS page_versions (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id    uuid        NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      text        NOT NULL,
    content    jsonb       NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_page_versions_page
    ON page_versions (page_id, created_at DESC);

-- ── page_comments (flat) ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS page_comments (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id    uuid        NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_page_comments_page
    ON page_comments (page_id, created_at);
