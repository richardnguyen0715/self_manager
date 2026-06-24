-- Work item activity / change history.
-- Records field-level changes (status, priority, due date, sprint, …) so the
-- "History" tab can show what happened to a work item over time.

CREATE TABLE IF NOT EXISTS work_item_activity (
    id           UUID PRIMARY KEY,
    work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL,
    field        TEXT NOT NULL,            -- "created", "status", "due_date", …
    old_value    TEXT,
    new_value    TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_item_activity_item
    ON work_item_activity (work_item_id, created_at DESC);
