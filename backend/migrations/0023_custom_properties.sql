-- =============================================================================
-- 0023_custom_properties
--
-- Per-project custom fields on work items (see design/estimate-custom-props.md,
-- section B). A property belongs to one project; a value belongs to one work
-- item and one property. Values cascade with both sides.
--
-- Idempotent: every CREATE uses IF NOT EXISTS.
-- =============================================================================

CREATE TABLE IF NOT EXISTS custom_properties (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users (id)    ON DELETE CASCADE,
    project_id  uuid        NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    name        text        NOT NULL,
    type        text        NOT NULL CHECK (type IN ('text', 'number', 'select', 'multi_select', 'date', 'checkbox', 'url')),
    -- [{ "id": "<short string>", "label": "...", "color": "#rrggbb" }] for select / multi_select
    options     jsonb       NOT NULL DEFAULT '[]'::jsonb,
    position    int         NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_properties_project_name
    ON custom_properties (project_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_custom_properties_user_project
    ON custom_properties (user_id, project_id);

CREATE TABLE IF NOT EXISTS work_item_property_values (
    work_item_id  uuid        NOT NULL REFERENCES work_items (id)       ON DELETE CASCADE,
    property_id   uuid        NOT NULL REFERENCES custom_properties (id) ON DELETE CASCADE,
    value         jsonb       NOT NULL,
    updated_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (work_item_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_work_item_property_values_property
    ON work_item_property_values (property_id);
