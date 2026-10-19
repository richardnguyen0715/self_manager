-- =============================================================================
-- 0024_mentions
--
-- Generic `@mention` graph (see design/mentions-and-retro-notes.md, section 3)
-- plus free-form rich notes on retros.
--
-- `mentions` rows are written by `PUT /api/mentions/sync` from the source's
-- editor content. Targets are polymorphic (no FK), like `retro_links`: owner
-- and existence are checked in code. Dangling rows are skipped at read time.
--
-- Idempotent: IF NOT EXISTS everywhere.
-- =============================================================================

CREATE TABLE IF NOT EXISTS mentions (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type text        NOT NULL
                CHECK (source_type IN ('work_item','doc','retro')),
    source_id   uuid        NOT NULL,
    target_type text        NOT NULL
                CHECK (target_type IN ('work_item','doc','sprint','project','epic','initiative','goal','habit','retro')),
    target_id   uuid        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mentions_source_target_uniq UNIQUE (source_type, source_id, target_type, target_id)
);

-- Backlinks: "who mentions this target".
CREATE INDEX IF NOT EXISTS mentions_user_target_idx ON mentions (user_id, target_type, target_id);
-- Sync: replace the mention set of one source.
CREATE INDEX IF NOT EXISTS mentions_source_idx ON mentions (source_type, source_id);

-- Retro free-form notes (HTML from the rich editor, <= 100000 chars enforced in code).
ALTER TABLE retros ADD COLUMN IF NOT EXISTS notes text;
