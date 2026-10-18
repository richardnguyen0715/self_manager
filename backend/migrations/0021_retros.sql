-- =============================================================================
-- 0021_retros
--
-- Periodic reviews & retrospectives linked to any object (see
-- design/retro-system.md, section 2). Prefixed `retro_` so the legacy
-- `retrospectives` table (sprint retros) stays untouched and is backfilled
-- into `retros` below.
--
-- Idempotent: every CREATE uses IF NOT EXISTS, seeds use fixed ids with
-- ON CONFLICT DO NOTHING, and the backfill skips retros already present.
-- =============================================================================

-- ── Templates ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS retro_templates (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- NULL = built-in template, visible to every user.
    user_id     uuid        REFERENCES users(id) ON DELETE CASCADE,
    name        text        NOT NULL,
    kind        text        NOT NULL
                CHECK (kind IN ('daily','weekly','monthly','quarterly','yearly','sprint','project','custom')),
    description text,
    is_builtin  boolean     NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS retro_templates_user_idx ON retro_templates (user_id);

CREATE TABLE IF NOT EXISTS retro_template_sections (
    id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid    NOT NULL REFERENCES retro_templates(id) ON DELETE CASCADE,
    position    int     NOT NULL DEFAULT 0,
    key         text    NOT NULL,
    title       text    NOT NULL,
    prompt      text,
    input_type  text    NOT NULL
                CHECK (input_type IN ('cards','text','rating','mood','checklist','auto_metrics')),
    auto_source text
                CHECK (auto_source IS NULL OR auto_source IN ('completed_items','habits','focus','sprint','overdue','all')),
    UNIQUE (template_id, key)
);

-- ── Retros ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS retros (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id  uuid        REFERENCES retro_templates(id) ON DELETE SET NULL,
    kind         text        NOT NULL
                 CHECK (kind IN ('daily','weekly','monthly','quarterly','yearly','sprint','project','custom')),
    title        text        NOT NULL,
    period_start date        NOT NULL,
    period_end   date        NOT NULL,
    scope_type   text        NOT NULL DEFAULT 'none'
                 CHECK (scope_type IN ('none','sprint','project','epic','initiative','goal','work_item','habit')),
    scope_id     uuid,
    status       text        NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','completed')),
    rating       smallint    CHECK (rating BETWEEN 1 AND 5),
    mood         smallint    CHECK (mood BETWEEN 1 AND 5),
    summary      text,
    snapshot     jsonb       NOT NULL DEFAULT '{}'::jsonb,
    started_at   timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- One retro per (user, cadence, period, scope). `open` relies on this index.
CREATE UNIQUE INDEX IF NOT EXISTS retros_user_kind_period_scope_uniq
    ON retros (user_id, kind, period_start, scope_type,
               (COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid)));

CREATE INDEX IF NOT EXISTS retros_user_kind_period_idx ON retros (user_id, kind, period_start DESC);
CREATE INDEX IF NOT EXISTS retros_scope_idx            ON retros (scope_type, scope_id);

-- ── Sections (per-retro copy of template sections) ───────────────────────────

CREATE TABLE IF NOT EXISTS retro_sections (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    retro_id    uuid NOT NULL REFERENCES retros(id) ON DELETE CASCADE,
    position    int  NOT NULL DEFAULT 0,
    key         text NOT NULL,
    title       text NOT NULL,
    prompt      text,
    input_type  text NOT NULL
                CHECK (input_type IN ('cards','text','rating','mood','checklist','auto_metrics')),
    auto_source text
);

CREATE INDEX IF NOT EXISTS retro_sections_retro_idx ON retro_sections (retro_id, position);

-- ── Entries ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS retro_entries (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    retro_id   uuid        NOT NULL REFERENCES retros(id) ON DELETE CASCADE,
    section_id uuid        NOT NULL REFERENCES retro_sections(id) ON DELETE CASCADE,
    position   int         NOT NULL DEFAULT 0,
    body       text        NOT NULL DEFAULT '',
    rating     smallint    CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
    mood       smallint    CHECK (mood IS NULL OR mood BETWEEN 1 AND 5),
    checked    boolean     NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS retro_entries_retro_idx   ON retro_entries (retro_id);
CREATE INDEX IF NOT EXISTS retro_entries_section_idx ON retro_entries (section_id, position);

-- ── Links (polymorphic, no FK on target; validated in the service) ───────────

CREATE TABLE IF NOT EXISTS retro_links (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    retro_id    uuid        NOT NULL REFERENCES retros(id) ON DELETE CASCADE,
    target_type text        NOT NULL
                CHECK (target_type IN ('work_item','sprint','project','epic','initiative','goal','habit','doc','retro')),
    target_id   uuid        NOT NULL,
    relation    text        NOT NULL DEFAULT 'about'
                CHECK (relation IN ('about','evidence','action_source','mentions')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (retro_id, target_type, target_id, relation)
);

CREATE INDEX IF NOT EXISTS retro_links_target_idx ON retro_links (target_type, target_id);

-- ── Actions ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS retro_actions (
    id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    retro_id               uuid        NOT NULL REFERENCES retros(id) ON DELETE CASCADE,
    user_id                uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text                   text        NOT NULL,
    status                 text        NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open','done','dropped')),
    due_date               date,
    work_item_id           uuid        REFERENCES work_items(id) ON DELETE SET NULL,
    carried_from_action_id uuid        REFERENCES retro_actions(id) ON DELETE SET NULL,
    carry_count            int         NOT NULL DEFAULT 0,
    position               int         NOT NULL DEFAULT 0,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    completed_at           timestamptz
);

CREATE INDEX IF NOT EXISTS retro_actions_user_status_idx ON retro_actions (user_id, status);
CREATE INDEX IF NOT EXISTS retro_actions_retro_idx       ON retro_actions (retro_id, position);

-- ── Built-in templates (user_id NULL, is_builtin true) ───────────────────────

INSERT INTO retro_templates (id, user_id, name, kind, description, is_builtin) VALUES
    ('a0000000-0000-4000-8000-000000000001', NULL, 'Daily check-in',     'daily',     'Quick end-of-day check-in.',                    true),
    ('a0000000-0000-4000-8000-000000000002', NULL, 'Weekly review',      'weekly',    'Review the week and plan the next one.',        true),
    ('a0000000-0000-4000-8000-000000000003', NULL, 'Monthly review',     'monthly',   'Look back over the month and set focus.',       true),
    ('a0000000-0000-4000-8000-000000000004', NULL, 'Quarterly review',   'quarterly', 'Review objectives and place next bets.',        true),
    ('a0000000-0000-4000-8000-000000000005', NULL, 'Yearly review',     'yearly',    'Year-end reflection and themes for next year.', true),
    ('a0000000-0000-4000-8000-000000000006', NULL, 'Sprint retro',       'sprint',    'Classic start / stop / continue sprint retro.', true),
    ('a0000000-0000-4000-8000-000000000007', NULL, 'Project retro (4Ls)','project',   'Liked, learned, lacked, longed for.',           true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO retro_template_sections (template_id, position, key, title, prompt, input_type, auto_source) VALUES
    -- Daily check-in
    ('a0000000-0000-4000-8000-000000000001', 0, 'context',  'Today at a glance', NULL,                           'auto_metrics', 'all'),
    ('a0000000-0000-4000-8000-000000000001', 1, 'mood',     'Mood',              'How do you feel today?',       'mood',         NULL),
    ('a0000000-0000-4000-8000-000000000001', 2, 'wins',     'Wins',              'What went well today?',        'cards',        NULL),
    ('a0000000-0000-4000-8000-000000000001', 3, 'blockers', 'Blockers',          'What got in the way?',         'cards',        NULL),
    ('a0000000-0000-4000-8000-000000000001', 4, 'tomorrow', 'Tomorrow',          'Top 3 for tomorrow',           'checklist',    NULL),
    -- Weekly review
    ('a0000000-0000-4000-8000-000000000002', 0, 'context',   'This week at a glance', NULL,                      'auto_metrics', 'all'),
    ('a0000000-0000-4000-8000-000000000002', 1, 'rating',    'Overall rating',        'How was the week? (1-5)', 'rating',      NULL),
    ('a0000000-0000-4000-8000-000000000002', 2, 'wins',      'Wins',                  'What went well?',         'cards',       NULL),
    ('a0000000-0000-4000-8000-000000000002', 3, 'misses',    'Misses',                'What did not happen?',    'cards',       NULL),
    ('a0000000-0000-4000-8000-000000000002', 4, 'lessons',   'Lessons',               'What did you learn?',     'cards',       NULL),
    ('a0000000-0000-4000-8000-000000000002', 5, 'next_week', 'Next week',             'Top priorities',          'checklist',   NULL),
    ('a0000000-0000-4000-8000-000000000002', 6, 'habits',    'Habits',                'Habit reflections',       'text',        NULL),
    -- Monthly review
    ('a0000000-0000-4000-8000-000000000003', 0, 'context',    'This month at a glance', NULL,                    'auto_metrics', 'all'),
    ('a0000000-0000-4000-8000-000000000003', 1, 'rating',     'Overall rating',         'How was the month? (1-5)', 'rating',    NULL),
    ('a0000000-0000-4000-8000-000000000003', 2, 'goals',      'Goals',                  'Progress on goals',      'text',        NULL),
    ('a0000000-0000-4000-8000-000000000003', 3, 'wins',       'Wins',                   'What went well?',        'cards',       NULL),
    ('a0000000-0000-4000-8000-000000000003', 4, 'drop',       'Drop',                   'What to stop or drop',   'cards',       NULL),
    ('a0000000-0000-4000-8000-000000000003', 5, 'focus_next', 'Focus next month',       'Focus areas',            'checklist',   NULL),
    -- Quarterly review
    ('a0000000-0000-4000-8000-000000000004', 0, 'context',     'This quarter at a glance', NULL,                  'auto_metrics', 'all'),
    ('a0000000-0000-4000-8000-000000000004', 1, 'rating',      'Overall rating',           'How was the quarter? (1-5)', 'rating', NULL),
    ('a0000000-0000-4000-8000-000000000004', 2, 'objectives',  'Objectives',               'Objectives and outcomes', 'text',     NULL),
    ('a0000000-0000-4000-8000-000000000004', 3, 'wins',        'Wins',                     'What went well?',        'cards',      NULL),
    ('a0000000-0000-4000-8000-000000000004', 4, 'lessons',     'Lessons',                  'What did you learn?',    'cards',      NULL),
    ('a0000000-0000-4000-8000-000000000004', 5, 'bets_next',   'Bets for next quarter',    'Bets to place',          'checklist',  NULL),
    -- Yearly review
    ('a0000000-0000-4000-8000-000000000005', 0, 'context',     'This year at a glance', NULL,                    'auto_metrics', 'all'),
    ('a0000000-0000-4000-8000-000000000005', 1, 'rating',      'Overall rating',        'How was the year? (1-5)', 'rating',     NULL),
    ('a0000000-0000-4000-8000-000000000005', 2, 'highlights',  'Highlights',            'Highlights of the year', 'cards',      NULL),
    ('a0000000-0000-4000-8000-000000000005', 3, 'lessons',     'Lessons',               'What did you learn?',    'cards',      NULL),
    ('a0000000-0000-4000-8000-000000000005', 4, 'themes_next', 'Themes for next year',  'Themes and intentions',  'text',       NULL),
    -- Sprint retro
    ('a0000000-0000-4000-8000-000000000006', 0, 'context',   'Sprint at a glance', NULL,                          'auto_metrics', 'sprint'),
    ('a0000000-0000-4000-8000-000000000006', 1, 'went_well', 'Went well',         'What went well this sprint?',  'cards',        NULL),
    ('a0000000-0000-4000-8000-000000000006', 2, 'start',     'Start',            'What should we start doing?',  'cards',        NULL),
    ('a0000000-0000-4000-8000-000000000006', 3, 'stop',      'Stop',             'What should we stop doing?',   'cards',        NULL),
    ('a0000000-0000-4000-8000-000000000006', 4, 'continue',  'Continue',         'What should we keep doing?',   'cards',        NULL),
    -- Project retro (4Ls)
    ('a0000000-0000-4000-8000-000000000007', 0, 'context',    'Project at a glance', NULL,                        'auto_metrics', 'all'),
    ('a0000000-0000-4000-8000-000000000007', 1, 'liked',     'Liked',               'What did you like?',         'cards',        NULL),
    ('a0000000-0000-4000-8000-000000000007', 2, 'learned',   'Learned',             'What did you learn?',        'cards',        NULL),
    ('a0000000-0000-4000-8000-000000000007', 3, 'lacked',    'Lacked',              'What was missing?',          'cards',        NULL),
    ('a0000000-0000-4000-8000-000000000007', 4, 'longed_for','Longed for',          'What did you wish for?',     'cards',        NULL)
ON CONFLICT (template_id, key) DO NOTHING;

-- ── Backfill legacy sprint retrospectives ────────────────────────────────────
--
-- Each `retrospectives` row becomes a completed `sprint` retro with the same
-- id. went_well -> section `went_well`, went_wrong -> section `stop`,
-- action_items (strings or {text} objects) -> open retro_actions. Rows whose
-- id is already present are skipped; a malformed row is logged and skipped
-- without failing the migration.

DO $$
DECLARE
    r           record;
    sp          record;
    sprint_tpl  constant uuid := 'a0000000-0000-4000-8000-000000000006';
    v_inserted  int;
    v_elem      jsonb;
    v_text      text;
    v_pos       int;
BEGIN
    FOR r IN
        SELECT * FROM retrospectives ORDER BY created_at, id
    LOOP
        BEGIN
            SELECT s.name, s.start_date, s.end_date
              INTO sp
              FROM sprints s
             WHERE s.id = r.sprint_id;

            INSERT INTO retros (
                id, user_id, template_id, kind, title,
                period_start, period_end, scope_type, scope_id,
                status, started_at, completed_at, created_at, updated_at
            )
            VALUES (
                r.id, r.user_id, sprint_tpl, 'sprint',
                'Retro — ' || COALESCE(sp.name, 'Sprint'),
                COALESCE(sp.start_date, r.created_at::date),
                COALESCE(sp.end_date, r.created_at::date),
                'sprint', r.sprint_id,
                'completed', r.created_at, r.updated_at, r.created_at, r.updated_at
            )
            ON CONFLICT DO NOTHING;

            GET DIAGNOSTICS v_inserted = ROW_COUNT;
            CONTINUE WHEN v_inserted = 0;

            INSERT INTO retro_sections (retro_id, position, key, title, prompt, input_type, auto_source)
            SELECT r.id, t.position, t.key, t.title, t.prompt, t.input_type, t.auto_source
              FROM retro_template_sections t
             WHERE t.template_id = sprint_tpl;

            IF NULLIF(BTRIM(r.went_well), '') IS NOT NULL THEN
                INSERT INTO retro_entries (retro_id, section_id, position, body)
                SELECT r.id, s.id, 0, r.went_well
                  FROM retro_sections s
                 WHERE s.retro_id = r.id AND s.key = 'went_well';
            END IF;

            IF NULLIF(BTRIM(r.went_wrong), '') IS NOT NULL THEN
                INSERT INTO retro_entries (retro_id, section_id, position, body)
                SELECT r.id, s.id, 0, r.went_wrong
                  FROM retro_sections s
                 WHERE s.retro_id = r.id AND s.key = 'stop';
            END IF;

            v_pos := 0;
            IF jsonb_typeof(r.action_items) = 'array' THEN
                FOR v_elem IN SELECT value FROM jsonb_array_elements(r.action_items)
                LOOP
                    v_text := CASE jsonb_typeof(v_elem)
                                WHEN 'string' THEN v_elem #>> '{}'
                                WHEN 'object' THEN COALESCE(v_elem->>'text', v_elem->>'title', '')
                                ELSE NULL
                              END;
                    IF NULLIF(BTRIM(v_text), '') IS NOT NULL THEN
                        INSERT INTO retro_actions (retro_id, user_id, text, status, position, created_at, updated_at)
                        VALUES (r.id, r.user_id, BTRIM(v_text), 'open', v_pos, r.created_at, r.updated_at);
                        v_pos := v_pos + 1;
                    END IF;
                END LOOP;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'retro backfill skipped legacy retrospective %: %', r.id, SQLERRM;
        END;
    END LOOP;
END;
$$;
