-- =============================================================================
-- Migration: 0008_docs_v2.sql  (Notion parity: page meta, backlinks, databases)
-- Additive. enum-as-text + CHECK. jsonb blobs. FKs ON DELETE CASCADE.
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── pages: new Notion-parity columns ────────────────────────────────────────
ALTER TABLE pages ADD COLUMN IF NOT EXISTS icon        text;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS cover_url   text;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS is_public   boolean NOT NULL DEFAULT false;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS public_slug text;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pages_public_slug
    ON pages (public_slug) WHERE public_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pages_public ON pages (is_public) WHERE is_public;
CREATE INDEX IF NOT EXISTS idx_pages_template
    ON pages (space_id) WHERE is_template;

-- ── page_links (backlinks graph) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS page_links (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    source_page_id uuid        NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    target_page_id uuid        NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    user_id        uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source_page_id, target_page_id)
);
CREATE INDEX IF NOT EXISTS idx_page_links_target ON page_links (target_page_id);
CREATE INDEX IF NOT EXISTS idx_page_links_source ON page_links (source_page_id);

-- ── databases ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS databases (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id   uuid        NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    user_id    uuid        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    title      text        NOT NULL DEFAULT 'Untitled Database',
    icon       text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_databases_space ON databases (space_id);
CREATE INDEX IF NOT EXISTS idx_databases_user  ON databases (user_id);
CREATE INDEX IF NOT EXISTS idx_databases_title_trgm
    ON databases USING gin (title gin_trgm_ops);

-- ── database_columns ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS database_columns (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    database_id uuid        NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
    name        text        NOT NULL,
    type        text        NOT NULL
                    CHECK (type IN ('text','number','date','checkbox',
                                    'select','multi_select','status','url')),
    options     jsonb       NOT NULL DEFAULT '[]'::jsonb,
    position    int         NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_database_columns_db
    ON database_columns (database_id, position);

-- ── database_rows ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS database_rows (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    database_id uuid        NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
    values      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    position    int         NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_database_rows_db
    ON database_rows (database_id, position);
CREATE INDEX IF NOT EXISTS idx_database_rows_values
    ON database_rows USING gin (values jsonb_path_ops);

-- ── database_views ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS database_views (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    database_id uuid        NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
    name        text        NOT NULL,
    type        text        NOT NULL CHECK (type IN ('table','board')),
    config      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    position    int         NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_database_views_db
    ON database_views (database_id, position);
