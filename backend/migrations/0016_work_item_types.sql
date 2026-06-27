-- =============================================================================
-- 0016_work_item_types
--
-- Extend work_item_type with developer-workflow categories. ADD VALUE IF NOT
-- EXISTS is idempotent and safe inside the migration transaction (the new
-- labels are not used within this same transaction).
-- =============================================================================

ALTER TYPE work_item_type ADD VALUE IF NOT EXISTS 'epic';
ALTER TYPE work_item_type ADD VALUE IF NOT EXISTS 'debug';
ALTER TYPE work_item_type ADD VALUE IF NOT EXISTS 'fix';
ALTER TYPE work_item_type ADD VALUE IF NOT EXISTS 'feat';
ALTER TYPE work_item_type ADD VALUE IF NOT EXISTS 'docs';
ALTER TYPE work_item_type ADD VALUE IF NOT EXISTS 'revert';
ALTER TYPE work_item_type ADD VALUE IF NOT EXISTS 'deploy';
ALTER TYPE work_item_type ADD VALUE IF NOT EXISTS 'release';
