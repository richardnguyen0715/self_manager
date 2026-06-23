ALTER TABLE work_items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE tasks      ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE projects   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_work_items_active ON work_items(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_active      ON tasks(user_id)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_active   ON projects(user_id)   WHERE deleted_at IS NULL;
