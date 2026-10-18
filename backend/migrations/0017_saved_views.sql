-- =============================================================================
-- 0017_saved_views
--
-- Plane-style saved views: a named bundle of filters + display options for a
-- scope (work items list, backlog, board). Scoped per user and optionally per
-- project (NULL = "all projects").
-- =============================================================================

CREATE TABLE IF NOT EXISTS saved_views (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    project_id  uuid        REFERENCES projects (id) ON DELETE CASCADE,
    name        text        NOT NULL,
    scope       text        NOT NULL DEFAULT 'work_items'
                            CHECK (scope IN ('work_items', 'backlog', 'board')),
    filters     jsonb       NOT NULL DEFAULT '{}'::jsonb,
    display     jsonb       NOT NULL DEFAULT '{}'::jsonb,
    position    int         NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_views_user_scope_position
    ON saved_views (user_id, scope, position);
