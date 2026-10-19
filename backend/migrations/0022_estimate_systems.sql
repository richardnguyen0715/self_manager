-- =============================================================================
-- 0022_estimate_systems
--
-- Per-project estimate systems (see design/estimate-custom-props.md, section A).
-- `work_items.story_points` stays the stored value (int); a project picks a
-- system that defines the allowed values and labels. The allowed-value lists
-- live in the backend `estimate` module, not in the database.
--
-- 1. projects.estimate_system: one of fibonacci (default), linear, tshirt,
--    hours, none.
-- 2. work_items.story_points: drop the old global CHECK (IN (1,3,5,8)) and
--    replace it with a range check. Per-system validation happens in the
--    service layer.
--
-- Idempotent: safe to re-run.
-- =============================================================================

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS estimate_system text NOT NULL DEFAULT 'fibonacci'
    CONSTRAINT projects_estimate_system_check
        CHECK (estimate_system IN ('fibonacci', 'linear', 'tshirt', 'hours', 'none'));

DO $$
DECLARE
    r record;
BEGIN
    -- Drop the legacy story_points CHECK (IN (1,3,5,8)), found by definition.
    FOR r IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'work_items'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%story_points%'
          AND conname <> 'work_items_story_points_range'
    LOOP
        EXECUTE format('ALTER TABLE work_items DROP CONSTRAINT %I', r.conname);
    END LOOP;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'work_items'::regclass
          AND conname = 'work_items_story_points_range'
    ) THEN
        ALTER TABLE work_items
            ADD CONSTRAINT work_items_story_points_range
            CHECK (story_points IS NULL OR (story_points > 0 AND story_points <= 1000));
    END IF;
END $$;
