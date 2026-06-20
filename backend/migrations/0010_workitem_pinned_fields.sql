ALTER TABLE work_items ADD COLUMN IF NOT EXISTS pinned_fields text[] NOT NULL DEFAULT '{}';
