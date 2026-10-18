-- =============================================================================
-- 0019_labels
--
-- Managed labels with colours (Plane-style). `work_items.labels` (text[]) stays
-- the source of truth for assignment by name; this table supplies the colour
-- and the management surface (rename / recolour / delete).
--
-- Scope: a label is owned by a user and optionally belongs to one project
-- (project_id NULL = global to the user). Names are unique per user+scope,
-- case-insensitively.
--
-- Idempotent: safe to re-run.
-- =============================================================================

CREATE TABLE IF NOT EXISTS labels (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users (id)    ON DELETE CASCADE,
    project_id  uuid                 REFERENCES projects (id) ON DELETE CASCADE,
    name        text        NOT NULL,
    color       text        NOT NULL DEFAULT '#64748b',
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_labels_user_scope_name
    ON labels (
        user_id,
        lower(name),
        COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

CREATE INDEX IF NOT EXISTS idx_labels_user_project
    ON labels (user_id, project_id);

-- ---------------------------------------------------------------------------
-- Backfill: one global label row per distinct (user, label name) already used
-- on a work item. Colour is picked deterministically from a 10-colour palette
-- (same palette as the frontend presets) by hashing the name. Re-running only
-- inserts rows that are missing.
-- ---------------------------------------------------------------------------
INSERT INTO labels (user_id, project_id, name, color)
SELECT DISTINCT
    wi.user_id,
    NULL::uuid,
    l.name,
    (ARRAY[
        '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6',
        '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'
    ])[(abs(hashtext(l.name)) % 10) + 1]
FROM work_items wi
CROSS JOIN LATERAL unnest(wi.labels) AS l(name)
WHERE l.name IS NOT NULL AND btrim(l.name) <> ''
ON CONFLICT DO NOTHING;
