-- =============================================================================
-- 0018_item_keys
--
-- Plane/Jira-style human-readable work item keys (e.g. `MML-12`).
--
--   * projects.key     2-5 uppercase letters, unique per user. Derived from the
--                      project name initials when not supplied.
--   * work_items.seq_id per-(user, project) sequence number. Items without a
--                      project use the `WI` prefix (same user-scoped sequence,
--                      keyed by NULL project_id).
--
-- Idempotent: every statement can be re-run safely.
-- =============================================================================

-- ── Columns ──────────────────────────────────────────────────────────────────

ALTER TABLE projects   ADD COLUMN IF NOT EXISTS key    text;
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS seq_id int;

-- ── Project key derivation helpers ───────────────────────────────────────────

-- Candidate key from a project name: initials of the words (e.g. "Manage My
-- Life" -> "MML"); when that yields fewer than 2 letters, the first letters of
-- the name; fallback "WI". Result is 2-5 uppercase letters.
CREATE OR REPLACE FUNCTION mml_project_key_candidate(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    base text;
BEGIN
    SELECT COALESCE(string_agg(upper(left(w.word, 1)), '' ORDER BY w.ord), '')
      INTO base
      FROM regexp_split_to_table(
               btrim(regexp_replace(COALESCE(p_name, ''), '[^A-Za-z0-9]+', ' ', 'g')),
               ' '
           ) WITH ORDINALITY AS w(word, ord)
     WHERE w.word ~ '^[A-Za-z]';

    IF length(base) < 2 THEN
        base := upper(regexp_replace(COALESCE(p_name, ''), '[^A-Za-z]', '', 'g'));
    END IF;

    base := left(base, 5);

    IF length(base) < 2 THEN
        base := 'WI';
    END IF;

    RETURN base;
END;
$$;

-- Unique-per-user key for a project. Collisions get a numeric suffix (MML, MM2,
-- MM3, ...); the base is truncated so the whole key stays within 5 characters.
CREATE OR REPLACE FUNCTION mml_unique_project_key(p_user uuid, p_name text, p_exclude uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    base text;
    cand text;
    n    int := 1;
BEGIN
    base := mml_project_key_candidate(p_name);
    cand := base;
    WHILE EXISTS (
        SELECT 1 FROM projects
         WHERE user_id = p_user
           AND key = cand
           AND (p_exclude IS NULL OR id <> p_exclude)
    ) LOOP
        n := n + 1;
        cand := left(base, 5 - length(n::text)) || n::text;
    END LOOP;
    RETURN cand;
END;
$$;

-- ── Backfill project keys ────────────────────────────────────────────────────

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT id, user_id, name
          FROM projects
         WHERE key IS NULL
         ORDER BY created_at, id
    LOOP
        UPDATE projects
           SET key = mml_unique_project_key(r.user_id, r.name, r.id)
         WHERE id = r.id;
    END LOOP;
END;
$$;

-- Uniqueness per user (only for keyed rows, so the column stays nullable-safe).
CREATE UNIQUE INDEX IF NOT EXISTS projects_user_key_uniq
    ON projects (user_id, key)
    WHERE key IS NOT NULL;

-- ── Backfill work item sequence numbers ──────────────────────────────────────

UPDATE work_items w
   SET seq_id = s.rn
  FROM (
        SELECT id,
               row_number() OVER (
                   PARTITION BY user_id, project_id
                   ORDER BY created_at, id
               ) AS rn
          FROM work_items
       ) s
 WHERE w.id = s.id
   AND w.seq_id IS NULL;

-- One number per (user, project) — NULL project_id counts as its own group.
CREATE UNIQUE INDEX IF NOT EXISTS work_items_user_project_seq_uniq
    ON work_items (user_id, project_id, seq_id) NULLS NOT DISTINCT;
