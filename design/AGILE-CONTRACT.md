# AGILE-CONTRACT — Personal Agile OS Migration (Canonical Source of Truth)

> **Status:** AUTHORITATIVE. Every backend/frontend agent reads this file and MUST NOT deviate.
> **Migration stance:** ADDITIVE onto the CURRENT working system. Nothing working is deleted.
> `task` and `project` modules stay mounted as **legacy**. `work_items` is the new primary work entity.
> KEEP: auth, goal, habit, calendar, timeblock, analytics, notification, search, dashboard, settings, realtime, project, task.
>
> **Backend conventions (proven, MUST follow — derived from `goal` module):**
> - Each module: `models.rs`, `service.rs`, `handlers.rs`, `routes.rs`, `mod.rs`.
> - Handlers are thin: extract `AuthUser` + `State<AppState>` + `Path`/`Query`/`Json`, call `body.validate().map_err(|e| AppError::Validation(e.to_string()))?`, delegate to `service`.
> - Ownership ALWAYS enforced via `WHERE user_id = $n`; missing row ⇒ `AppError::NotFound`.
> - **Enum-as-text pattern** (NOT `sqlx::Type` derive for the new tables): store columns as plain Postgres enums; in SQL `SELECT col::text AS "col!"`, filter with `col::text = $n`, bind/insert with `($n::text)::enum_name`. Rust row structs carry `pub status: String`. Typed request DTO enums (`#[serde(rename_all="snake_case")]`) expose `as_str() -> &'static str`.
> - `COUNT(*)` / `EXISTS(...)` scalars are nullable in sqlx ⇒ `.unwrap_or(0)` / `.unwrap_or(false)`.
> - `gen_random_uuid()`, `timestamptz`, `now()`, `set_updated_at()` trigger on every new table.
> - Errors: `AppError` ⇒ `{ "error": CODE, "message": ... }`. Validation = 422, conflict (capacity exceeded) = 409.
> - Domain events: `state.events.send(DomainEvent::...)` (best-effort, ignore the result).

---

## A. Domain Model

Legend: **NEW** = brand-new table/entity · **EVOLVED** = existing thing extended/superseded · **KEPT** = unchanged.

### Goal — KEPT
Top-level personal goal. Existing `goals` table is untouched.
- `id, user_id, title, description?, target_date?, status (goal_status), color?, position, created_at, updated_at`
- Relationships: `Goal 1──N Initiative` (NEW), `Goal 1──N Project` (KEPT legacy).

### Initiative — NEW
A strategic bucket under a Goal (e.g. "Backend Mastery").
- `id, user_id, goal_id (FK goals ON DELETE CASCADE), title, description?, status (initiative_status), color?, position, created_at, updated_at`
- Relationships: `Goal 1──N Initiative`, `Initiative 1──N Epic`.

### Epic — NEW
A multi-sprint body of work (e.g. "Learn Rust"). Has progress rollup computed from its work items.
- `id, user_id, initiative_id (FK initiatives ON DELETE CASCADE), title, description?, status (epic_status), start_date? (date), due_date? (date), color?, position, created_at, updated_at`
- Derived (computed in service, not stored): `progress { total_items, done_items, completion_rate }`, `total_points`, `done_points`.
- Relationships: `Initiative 1──N Epic`, `Epic 1──N WorkItem` (nullable).

### Sprint — NEW
Time-boxed container (one per planning period). Holds Work Items, Time Blocks (via work items), and Reviews/Retros.
- `id, user_id, name, goal_text? (free-text sprint goal), start_date (date), end_date (date), capacity_points (int, default 0), status (sprint_status: planned|active|completed), velocity? (numeric, % set on completion), completed_points (int default 0), created_at, updated_at`
- Derived: `planned_points` (Σ story_points of member work items), `committed_count`, `done_count`.
- Rules: at most one `active` sprint per user (enforced in service on activate). Adding a work item is rejected with **409** if `planned_points + item.points > capacity_points` when `capacity_points > 0`.
- Relationships: `Sprint 1──N WorkItem` (nullable), `Sprint 1──1 SprintReview`, `Sprint 1──1 Retrospective`.

### WorkItem — NEW (SUPERSEDES legacy `task`)
Primary unit of work. New table `work_items`. Legacy `tasks` rows are backfilled in (type `'task'`).
- `id, user_id, epic_id? (FK epics ON DELETE SET NULL), sprint_id? (FK sprints ON DELETE SET NULL — NULL ⇒ in Backlog), type (work_item_type: story|task|bug|habit|milestone), title, description?, status (work_item_status: backlog|todo|in_progress|review|done), priority (task_priority — REUSE existing enum: critical|high|medium|low), story_points? (int, allowed values 1|3|5|8, NULL = unestimated), position (int), due_date? (timestamptz), recurrence_rule? (text RRULE), completed_at? (timestamptz), created_at, updated_at`
- Relationships: `Epic 1──N WorkItem`, `Sprint 1──N WorkItem`, `WorkItem 1──N Subtask`, `WorkItem 1──N TimeBlock` (via `time_blocks.work_item_id`).
- Backlog membership = `sprint_id IS NULL`. Board column = `status`.

### Subtask (WorkItemSubtask) — NEW
Child checklist action of a work item. New table `work_item_subtasks` (mirrors legacy `subtasks` shape but FK to `work_items`).
- `id, work_item_id (FK work_items ON DELETE CASCADE), title, is_done (bool), position (int), created_at, updated_at`

### Backlog — NEW (VIEW, not a table)
Logical view = `work_items WHERE user_id = $1 AND sprint_id IS NULL` ordered by `position, created_at`. Flow: Inbox → Backlog → Sprint.

### Board — EVOLVED (VIEW, not a table)
Logical view over `work_items` grouped by `status` into columns Backlog / To do / In progress / Review / Done. Custom `kanban_columns` table is KEPT for the legacy task board; the agile board derives columns from `work_item_status`.

### SprintReview — NEW
Auto-created when a sprint is completed.
- `id, user_id, sprint_id (FK sprints ON DELETE CASCADE, UNIQUE), planned_points (int), completed_points (int), velocity (numeric, %), summary? (text), created_at, updated_at`

### Retrospective — NEW
- `id, user_id, sprint_id (FK sprints ON DELETE CASCADE, UNIQUE), went_well? (text), went_wrong? (text), action_items (jsonb, default '[]'), created_at, updated_at`

### TimeBlock — EVOLVED
Existing `time_blocks` table gains `work_item_id` (FK work_items ON DELETE SET NULL). Existing `task_id` column is KEPT for back-compat. A time block may reference either/both.

### Habit / HabitLog — KEPT
`habits` + `habit_logs` unchanged (streak/heatmap). A habit may ALSO appear as a `type='habit'` work item inside a sprint; linkage is by convention (optional future `habit_id` not added in 0003).

---

## B. DDL Plan — `backend/migrations/0003_agile.sql`

Reuses existing `pgcrypto`, `pg_trgm`, `set_updated_at()`, and `task_priority` enum.

```sql
-- =============================================================================
-- Migration: 0003_agile.sql — Personal Agile OS (additive)
-- Adds: initiatives, epics, sprints, work_items, work_item_subtasks,
--       sprint_reviews, retrospectives. Alters time_blocks. Backfills tasks.
-- =============================================================================

-- ── Enums (plain Postgres enums; services cast ::text) ──────────────────────
DO $$ BEGIN
    CREATE TYPE initiative_status AS ENUM ('active', 'completed', 'paused', 'abandoned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE epic_status AS ENUM ('todo', 'in_progress', 'done', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE sprint_status AS ENUM ('planned', 'active', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE work_item_type AS ENUM ('story', 'task', 'bug', 'habit', 'milestone');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE work_item_status AS ENUM ('backlog', 'todo', 'in_progress', 'review', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── initiatives ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS initiatives (
    id          uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid              NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    goal_id     uuid              NOT NULL REFERENCES goals (id) ON DELETE CASCADE,
    title       text              NOT NULL,
    description text,
    status      initiative_status NOT NULL DEFAULT 'active',
    color       text,
    position    int               NOT NULL DEFAULT 0,
    created_at  timestamptz       NOT NULL DEFAULT now(),
    updated_at  timestamptz       NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_initiatives_user_id ON initiatives (user_id);
CREATE INDEX IF NOT EXISTS idx_initiatives_goal_id ON initiatives (goal_id);

-- ── epics ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS epics (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    initiative_id uuid        NOT NULL REFERENCES initiatives (id) ON DELETE CASCADE,
    title         text        NOT NULL,
    description   text,
    status        epic_status NOT NULL DEFAULT 'todo',
    start_date    date,
    due_date      date,
    color         text,
    position      int         NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_epics_user_id       ON epics (user_id);
CREATE INDEX IF NOT EXISTS idx_epics_initiative_id ON epics (initiative_id);

-- ── sprints ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sprints (
    id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name             text          NOT NULL,
    goal_text        text,
    start_date       date          NOT NULL,
    end_date         date          NOT NULL,
    capacity_points  int           NOT NULL DEFAULT 0 CHECK (capacity_points >= 0),
    status           sprint_status NOT NULL DEFAULT 'planned',
    velocity         numeric(5,2),
    completed_points int           NOT NULL DEFAULT 0 CHECK (completed_points >= 0),
    created_at       timestamptz   NOT NULL DEFAULT now(),
    updated_at       timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT sprints_start_before_end CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_sprints_user_id ON sprints (user_id);
CREATE INDEX IF NOT EXISTS idx_sprints_status  ON sprints (user_id, status);
-- At most one active sprint per user:
CREATE UNIQUE INDEX IF NOT EXISTS uq_sprints_one_active
    ON sprints (user_id) WHERE status = 'active';

-- ── work_items ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_items (
    id              uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid             NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    epic_id         uuid             REFERENCES epics (id)   ON DELETE SET NULL,
    sprint_id       uuid             REFERENCES sprints (id) ON DELETE SET NULL,
    type            work_item_type   NOT NULL DEFAULT 'task',
    title           text             NOT NULL,
    description     text,
    status          work_item_status NOT NULL DEFAULT 'backlog',
    priority        task_priority    NOT NULL DEFAULT 'medium',
    story_points    int              CHECK (story_points IS NULL OR story_points IN (1,3,5,8)),
    position        int              NOT NULL DEFAULT 0,
    due_date        timestamptz,
    recurrence_rule text,
    completed_at    timestamptz,
    created_at      timestamptz      NOT NULL DEFAULT now(),
    updated_at      timestamptz      NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_work_items_user_id   ON work_items (user_id);
CREATE INDEX IF NOT EXISTS idx_work_items_epic_id   ON work_items (epic_id)   WHERE epic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_items_sprint_id ON work_items (sprint_id) WHERE sprint_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_items_backlog   ON work_items (user_id)   WHERE sprint_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_work_items_status    ON work_items (user_id, status);
CREATE INDEX IF NOT EXISTS idx_work_items_due_date  ON work_items (user_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_items_title_trgm ON work_items USING GIN (title gin_trgm_ops);

-- ── work_item_subtasks ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_item_subtasks (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    work_item_id uuid        NOT NULL REFERENCES work_items (id) ON DELETE CASCADE,
    title        text        NOT NULL,
    is_done      boolean     NOT NULL DEFAULT false,
    position     int         NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_work_item_subtasks_work_item_id ON work_item_subtasks (work_item_id);

-- ── sprint_reviews ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sprint_reviews (
    id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    sprint_id        uuid         NOT NULL REFERENCES sprints (id) ON DELETE CASCADE,
    planned_points   int          NOT NULL DEFAULT 0,
    completed_points int          NOT NULL DEFAULT 0,
    velocity         numeric(5,2) NOT NULL DEFAULT 0,
    summary          text,
    created_at       timestamptz  NOT NULL DEFAULT now(),
    updated_at       timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_sprint_reviews_sprint UNIQUE (sprint_id)
);
CREATE INDEX IF NOT EXISTS idx_sprint_reviews_user_id ON sprint_reviews (user_id);

-- ── retrospectives ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS retrospectives (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    sprint_id    uuid        NOT NULL REFERENCES sprints (id) ON DELETE CASCADE,
    went_well    text,
    went_wrong   text,
    action_items jsonb       NOT NULL DEFAULT '[]'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_retrospectives_sprint UNIQUE (sprint_id)
);
CREATE INDEX IF NOT EXISTS idx_retrospectives_user_id ON retrospectives (user_id);

-- ── ALTER time_blocks: add work_item_id (keep task_id) ──────────────────────
ALTER TABLE time_blocks
    ADD COLUMN IF NOT EXISTS work_item_id uuid REFERENCES work_items (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_time_blocks_work_item_id
    ON time_blocks (work_item_id) WHERE work_item_id IS NOT NULL;

-- ── Backfill: existing tasks → work_items (type='task') ─────────────────────
-- Map legacy task_status → work_item_status:
--   inbox|planned|waiting → backlog ; in_progress → in_progress ;
--   completed → done ; archived → done.
INSERT INTO work_items (
    id, user_id, epic_id, sprint_id, type, title, description,
    status, priority, story_points, position, due_date, recurrence_rule,
    completed_at, created_at, updated_at
)
SELECT
    t.id, t.user_id, NULL, NULL, 'task'::work_item_type, t.title, t.description,
    (CASE t.status::text
        WHEN 'in_progress' THEN 'in_progress'
        WHEN 'completed'   THEN 'done'
        WHEN 'archived'    THEN 'done'
        ELSE 'backlog'
     END)::work_item_status,
    t.priority,                       -- task_priority reused as-is
    NULL,                             -- story_points unestimated
    t.position, t.due_date, t.recurrence_rule, t.completed_at,
    t.created_at, t.updated_at
FROM tasks t
ON CONFLICT (id) DO NOTHING;          -- shared UUID keeps time_blocks.task_id aligned

-- ── updated_at triggers for new tables ──────────────────────────────────────
DO $$ DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'initiatives','epics','sprints','work_items','work_item_subtasks',
        'sprint_reviews','retrospectives'
    ] LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I;
             CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t,t,t,t);
    END LOOP;
END $$;
```

> Note: backfilled `work_items.id` == legacy `tasks.id`, so a later optional step can repoint `time_blocks.task_id` → `time_blocks.work_item_id`. Not required for 0003.

---

## C. Canonical REST Endpoint Map

All routes require `Authorization: Bearer <access-token>` (`AuthUser`). Response-shape column: **flat T** (object at top level), **{data:T}** (data envelope), **T[]** (bare array), **{data:[],total}** (list+total envelope as used by `goal`). NEW list endpoints follow the `goal` `{ data, total }` envelope.

### NEW — Initiatives (`/api/initiatives`)

| feature | method | full path | request body | query params | response |
|---|---|---|---|---|---|
| List | GET | `/api/initiatives` | — | `goal_id?`, `status?`, `limit?`, `offset?` | `{ data: Initiative[], total }` |
| Create | POST | `/api/initiatives` | `{ goal_id, title, description?, status?, color?, position? }` | — | flat `Initiative` (201) |
| Get | GET | `/api/initiatives/:id` | — | — | flat `Initiative` |
| Update | PATCH | `/api/initiatives/:id` | partial `{ title?, description?, status?, color?, position?, goal_id? }` | — | flat `Initiative` |
| Delete | DELETE | `/api/initiatives/:id` | — | — | 204 |
| Epics under | GET | `/api/initiatives/:id/epics` | — | — | `{ data: Epic[], total }` |

### NEW — Epics (`/api/epics`)

| feature | method | full path | request body | query params | response |
|---|---|---|---|---|---|
| List | GET | `/api/epics` | — | `initiative_id?`, `status?`, `limit?`, `offset?` | `{ data: Epic[], total }` |
| Create | POST | `/api/epics` | `{ initiative_id, title, description?, status?, start_date?, due_date?, color?, position? }` | — | flat `Epic` (201) |
| Get | GET | `/api/epics/:id` | — | — | flat `Epic` (includes `progress`, `total_points`, `done_points`) |
| Update | PATCH | `/api/epics/:id` | partial of create fields | — | flat `Epic` |
| Delete | DELETE | `/api/epics/:id` | — | — | 204 |
| Work items under | GET | `/api/epics/:id/work-items` | — | `status?` | `{ data: WorkItemListItem[], total }` |

### NEW — Sprints (`/api/sprints`)

| feature | method | full path | request body | query params | response |
|---|---|---|---|---|---|
| List | GET | `/api/sprints` | — | `status?`, `limit?`, `offset?` | `{ data: Sprint[], total }` |
| Create | POST | `/api/sprints` | `{ name, goal_text?, start_date, end_date, capacity_points? }` | — | flat `Sprint` (201) |
| Get | GET | `/api/sprints/:id` | — | — | flat `Sprint` (includes derived `planned_points`, `committed_count`, `done_count`) |
| Update | PATCH | `/api/sprints/:id` | partial `{ name?, goal_text?, start_date?, end_date?, capacity_points?, status? }` | — | flat `Sprint` |
| Delete | DELETE | `/api/sprints/:id` | — | — | 204 |
| Active sprint | GET | `/api/sprints/active` | — | — | flat `Sprint` or 404 |
| Activate | POST | `/api/sprints/:id/activate` | — | — | flat `Sprint` (status→active; 409 if another active) |
| Complete | POST | `/api/sprints/:id/complete` | `{ summary? }` | — | flat `SprintReview` (status→completed; auto review) |
| Work items | GET | `/api/sprints/:id/work-items` | — | `status?` | `{ data: WorkItemListItem[], total }` |
| Burndown | GET | `/api/sprints/:id/burndown` | — | — | flat `BurndownResponse` |
| Velocity | GET | `/api/sprints/velocity` | — | `last?` (default 6) | `{ data: VelocityPoint[] }` |
| Get review | GET | `/api/sprints/:id/review` | — | — | flat `SprintReview` or 404 |
| Upsert review | PUT | `/api/sprints/:id/review` | `{ summary? }` | — | flat `SprintReview` |
| Get retro | GET | `/api/sprints/:id/retrospective` | — | — | flat `Retrospective` or 404 |
| Upsert retro | PUT | `/api/sprints/:id/retrospective` | `{ went_well?, went_wrong?, action_items? }` | — | flat `Retrospective` |

### NEW — Work Items (`/api/work-items`)

| feature | method | full path | request body | query params | response |
|---|---|---|---|---|---|
| List | GET | `/api/work-items` | — | `sprint_id?`, `epic_id?`, `status?`, `type?`, `priority?`, `limit?`, `offset?` | `{ data: WorkItemListItem[], total }` |
| Create | POST | `/api/work-items` | `{ title, description?, type?, epic_id?, sprint_id?, status?, priority?, story_points?, due_date?, recurrence_rule? }` | — | flat `WorkItem` (201) |
| Get | GET | `/api/work-items/:id` | — | — | flat `WorkItem` (with `subtasks`) |
| Update | PATCH | `/api/work-items/:id` | partial of create fields + `position?` | — | flat `WorkItem` |
| Delete | DELETE | `/api/work-items/:id` | — | — | 204 |
| Set status | PATCH | `/api/work-items/:id/status` | `{ status }` | — | flat `WorkItem` (sets `completed_at` when→done) |
| Set points | PATCH | `/api/work-items/:id/points` | `{ story_points }` (1\|3\|5\|8\|null) | — | flat `WorkItem` |
| Move to sprint | PATCH | `/api/work-items/:id/sprint` | `{ sprint_id, position? }` | — | flat `WorkItem` (**409** if capacity exceeded) |
| Move to backlog | PATCH | `/api/work-items/:id/backlog` | `{ position? }` | — | flat `WorkItem` (sets `sprint_id=null`) |
| List subtasks | GET | `/api/work-items/:id/subtasks` | — | — | `WorkItemSubtask[]` |
| Add subtask | POST | `/api/work-items/:id/subtasks` | `{ title }` | — | flat `WorkItemSubtask` (201) |
| Update subtask | PATCH | `/api/work-items/:id/subtasks/:subtask_id` | `{ title?, is_done?, position? }` | — | flat `WorkItemSubtask` |
| Delete subtask | DELETE | `/api/work-items/:id/subtasks/:subtask_id` | — | — | 204 |

### NEW — Backlog (`/api/backlog`)

| feature | method | full path | request body | query params | response |
|---|---|---|---|---|---|
| List backlog | GET | `/api/backlog` | — | `epic_id?`, `limit?`, `offset?` | `{ data: WorkItemListItem[], total }` |

### EVOLVED — Dashboard (`/api/dashboard`) — additive, existing endpoints unchanged

| feature | method | full path | query params | response |
|---|---|---|---|---|
| Sprint dashboard | GET | `/api/dashboard/sprint` | `date?` | flat `SprintDashboardResponse` |

`SprintDashboardResponse = { active_sprint: Sprint?, sprint_progress_pct, goal_progress: GoalProgress[], today_time_blocks: DashboardTimeBlock[], overdue_work_items: WorkItemListItem[], habits: DashboardHabit[] }`. **Existing `/api/dashboard` and `/api/dashboard/stats` remain unchanged.**

### EVOLVED — Analytics (`/api/analytics`) — additive, existing endpoints unchanged

| feature | method | full path | query params | response |
|---|---|---|---|---|
| Velocity | GET | `/api/analytics/velocity` | `last?` (default 6) | `{ data: VelocityPoint[] }` |
| Burndown | GET | `/api/analytics/burndown` | `sprint_id` (required) | flat `BurndownResponse` |
| Time by epic | GET | `/api/analytics/time-by-epic` | `start`, `end` | `{ data: EpicTimePoint[] }` |

> `velocity` / `burndown` are intentionally mirrored under both `/api/sprints/*` and `/api/analytics/*`; both call the same service functions. Front-end may use either.

### KEPT — unchanged (NO modification)

`auth` (`/api/auth/*`), `task` (`/api/tasks/*` — legacy), `project` (`/api/projects/*` — legacy), `goal` (`/api/goals/*`), `habit` (`/api/habits/*`), `calendar` (`/api/calendar/*`), `timeblock` (`/api/timeblocks/*`, incl. `focus-sessions`), `analytics` (existing `summary|daily|time-usage|completion-rate|refresh`), `notification` (`/api/notifications/*`), `settings` (`/api/settings/*`), `search` (`/api/search`), `dashboard` (existing `/api/dashboard`, `/api/dashboard/stats`), `realtime` (`/ws`).

---

## D. Router Contract

### New modules — register in `backend/src/modules/mod.rs`
```rust
pub mod initiative;
pub mod epic;
pub mod sprint;
pub mod work_item;
pub mod backlog;
```
Each exposes: `pub fn router() -> axum::Router<crate::shared::state::AppState>`.

### Mount in `backend/src/main.rs` (add to `api_router`)
```rust
.nest("/initiatives", modules::initiative::router())
.nest("/epics",       modules::epic::router())
.nest("/sprints",     modules::sprint::router())
.nest("/work-items",  modules::work_item::router())
.nest("/backlog",     modules::backlog::router())
```
EVOLVED routers (`dashboard`, `analytics`) add their new routes **inside their own existing `router()`** — no main.rs change for those.

### New shared `DomainEvent` variants — append to `backend/src/shared/events.rs`
```rust
/// A work item transitioned to `done`.
WorkItemCompleted { work_item_id: Uuid, user_id: Uuid, sprint_id: Option<Uuid> },
/// A sprint was activated.
SprintStarted { sprint_id: Uuid, user_id: Uuid },
/// A sprint was completed (review auto-created).
SprintCompleted { sprint_id: Uuid, user_id: Uuid, completed_points: i32, velocity: f64 },
```
Emit `WorkItemCompleted` from `work_item::service` on status→done; `SprintStarted` on activate; `SprintCompleted` on complete. Best-effort (`let _ = state.events.send(...)`).

---

## E. Frontend

### Screens + routes (Next.js app router, under `frontend/src/app/`)

| screen | route | notes |
|---|---|---|
| Sprint Dashboard | `/dashboard` (EVOLVED) | active sprint progress %, goal progress, today time blocks, overdue items, habits. Existing dashboard kept; add sprint section. |
| Backlog | `/backlog` | NEW. stacked Sprint sections + Backlog section; drag work items into a sprint; per-row status pill, story points, due date; "Create sprint" / "Start sprint" / "Complete sprint" actions; capacity badge. |
| Board (active sprint) | `/board` | NEW. columns To do / In progress / In review / Done grouped by `work_item_status`; cards show title, due date, key/type icon; "Complete sprint" button. |
| Sprints list | `/sprints` | NEW. List all sprints (planned/active/completed) with velocity. |
| Sprint detail / Review / Retro | `/sprints/[id]` | NEW. Tabs: Overview, Review (planned/completed/velocity), Retrospective (went well / wrong / action items), Burndown chart. |
| Work Items list | `/work-items` | NEW. Filterable table of all work items. |
| Work Item detail | `/work-items/[id]` | NEW. title, description, Subtasks (with % done bar + add/link), status dropdown, right Details panel (Assignee=self, Priority, Parent/Epic, Due date, Start date, Sprint, Story point estimate, Reporter). Built with CURRENT shadcn components. |
| Goals hierarchy | `/goals` (EVOLVED) | Goal → Initiative → Epic tree, drill into epic work items. Existing goals page kept. |
| Analytics | `/analytics` (EVOLVED) | add Velocity chart, Burndown, Time-by-epic. |

### Sidebar nav items to add — `frontend/src/components/layout/sidebar.tsx` (`NAV_ITEMS`)
Insert after Dashboard, before legacy Tasks (use `lucide-react` icons):
```ts
{ label: "Backlog",    href: "/backlog",    icon: ListTodo },     // import ListTodo
{ label: "Board",      href: "/board",      icon: Trello },       // reuse Trello
{ label: "Sprints",    href: "/sprints",    icon: Rocket },       // import Rocket
{ label: "Work Items", href: "/work-items", icon: SquareKanban }, // import SquareKanban
```
Goals/Analytics nav entries stay. Legacy Tasks/Kanban entries MAY be relabelled "Tasks (legacy)" but stay mounted.

### TypeScript entity types to add — `frontend/src/types/index.ts`
```ts
// ── Agile enums ──────────────────────────────────────────────────────────────
export type InitiativeStatus = "active" | "completed" | "paused" | "abandoned";
export type EpicStatus       = "todo" | "in_progress" | "done" | "cancelled";
export type SprintStatus     = "planned" | "active" | "completed";
export type WorkItemType     = "story" | "task" | "bug" | "habit" | "milestone";
export type WorkItemStatus   = "backlog" | "todo" | "in_progress" | "review" | "done";
// priority reuses existing `Priority`

// ── Entities ─────────────────────────────────────────────────────────────────
export interface Initiative {
  id: string; user_id: string; goal_id: string; title: string;
  description: string | null; status: InitiativeStatus;
  color: string | null; position: number; created_at: string; updated_at: string;
}
export interface EpicProgress { total_items: number; done_items: number; completion_rate: number; }
export interface Epic {
  id: string; user_id: string; initiative_id: string; title: string;
  description: string | null; status: EpicStatus;
  start_date: string | null; due_date: string | null; // YYYY-MM-DD
  color: string | null; position: number;
  progress: EpicProgress; total_points: number; done_points: number;
  created_at: string; updated_at: string;
}
export interface Sprint {
  id: string; user_id: string; name: string; goal_text: string | null;
  start_date: string; end_date: string; // YYYY-MM-DD
  capacity_points: number; status: SprintStatus;
  velocity: number | null; completed_points: number;
  planned_points: number; committed_count: number; done_count: number;
  created_at: string; updated_at: string;
}
export interface WorkItemSubtask {
  id: string; work_item_id: string; title: string;
  is_done: boolean; position: number; created_at: string; updated_at: string;
}
export interface WorkItem {
  id: string; user_id: string; epic_id: string | null; sprint_id: string | null;
  type: WorkItemType; title: string; description: string | null;
  status: WorkItemStatus; priority: Priority; story_points: number | null;
  position: number; due_date: string | null; recurrence_rule: string | null;
  completed_at: string | null; created_at: string; updated_at: string;
  subtasks: WorkItemSubtask[];
}
export interface WorkItemListItem {
  id: string; epic_id: string | null; sprint_id: string | null;
  type: WorkItemType; title: string; status: WorkItemStatus; priority: Priority;
  story_points: number | null; due_date: string | null; position: number;
  subtask_count: number; done_subtask_count: number;
  created_at: string; updated_at: string;
}
export interface SprintReview {
  id: string; user_id: string; sprint_id: string;
  planned_points: number; completed_points: number; velocity: number;
  summary: string | null; created_at: string; updated_at: string;
}
export interface Retrospective {
  id: string; user_id: string; sprint_id: string;
  went_well: string | null; went_wrong: string | null;
  action_items: { id: string; text: string; done?: boolean }[];
  created_at: string; updated_at: string;
}
export interface BurndownPoint { date: string; remaining_points: number; ideal_points: number; }
export interface BurndownResponse {
  sprint_id: string; start_date: string; end_date: string;
  total_points: number; points: BurndownPoint[];
}
export interface VelocityPoint { sprint_id: string; sprint_name: string; planned_points: number; completed_points: number; velocity: number; }
export interface EpicTimePoint { epic_id: string; epic_title: string; focus_minutes: number; }
export interface GoalProgress { goal_id: string; title: string; completion_rate: number; }
export interface SprintDashboardResponse {
  active_sprint: Sprint | null; sprint_progress_pct: number;
  goal_progress: GoalProgress[]; today_time_blocks: DashboardTimeBlock[];
  overdue_work_items: WorkItemListItem[]; habits: DashboardHabit[];
}
// List envelope (matches goal module): { data, total }
export interface AgileListResponse<T> { data: T[]; total: number; }
```

### `API_ENDPOINTS` keys to add — `frontend/src/types/index.ts`
```ts
  // ── Initiatives ─────────────────────────────────────────────────────────────
  INITIATIVES: "/api/initiatives",
  INITIATIVE_BY_ID: (id: string) => `/api/initiatives/${id}`,
  INITIATIVE_EPICS: (id: string) => `/api/initiatives/${id}/epics`,
  // ── Epics ───────────────────────────────────────────────────────────────────
  EPICS: "/api/epics",
  EPIC_BY_ID: (id: string) => `/api/epics/${id}`,
  EPIC_WORK_ITEMS: (id: string) => `/api/epics/${id}/work-items`,
  // ── Sprints ─────────────────────────────────────────────────────────────────
  SPRINTS: "/api/sprints",
  SPRINT_ACTIVE: "/api/sprints/active",
  SPRINT_VELOCITY: "/api/sprints/velocity",
  SPRINT_BY_ID: (id: string) => `/api/sprints/${id}`,
  SPRINT_ACTIVATE: (id: string) => `/api/sprints/${id}/activate`,
  SPRINT_COMPLETE: (id: string) => `/api/sprints/${id}/complete`,
  SPRINT_WORK_ITEMS: (id: string) => `/api/sprints/${id}/work-items`,
  SPRINT_BURNDOWN: (id: string) => `/api/sprints/${id}/burndown`,
  SPRINT_REVIEW: (id: string) => `/api/sprints/${id}/review`,
  SPRINT_RETRO: (id: string) => `/api/sprints/${id}/retrospective`,
  // ── Work Items ──────────────────────────────────────────────────────────────
  WORK_ITEMS: "/api/work-items",
  WORK_ITEM_BY_ID: (id: string) => `/api/work-items/${id}`,
  WORK_ITEM_STATUS: (id: string) => `/api/work-items/${id}/status`,
  WORK_ITEM_POINTS: (id: string) => `/api/work-items/${id}/points`,
  WORK_ITEM_SPRINT: (id: string) => `/api/work-items/${id}/sprint`,
  WORK_ITEM_BACKLOG: (id: string) => `/api/work-items/${id}/backlog`,
  WORK_ITEM_SUBTASKS: (id: string) => `/api/work-items/${id}/subtasks`,
  WORK_ITEM_SUBTASK_BY_ID: (id: string, subtaskId: string) =>
    `/api/work-items/${id}/subtasks/${subtaskId}`,
  // ── Backlog ─────────────────────────────────────────────────────────────────
  BACKLOG: "/api/backlog",
  // ── Dashboard (evolved) ──────────────────────────────────────────────────────
  DASHBOARD_SPRINT: "/api/dashboard/sprint",
  // ── Analytics (evolved) ──────────────────────────────────────────────────────
  ANALYTICS_VELOCITY: "/api/analytics/velocity",
  ANALYTICS_BURNDOWN: "/api/analytics/burndown",
  ANALYTICS_TIME_BY_EPIC: "/api/analytics/time-by-epic",
```

---

## Invariants (every agent obeys)
1. ADDITIVE only — never drop/alter `tasks`, `projects`, `goals`, `habits`, `time_blocks.task_id`, or any KEPT endpoint.
2. New backend tables use **enum-as-text** in services (`::text` select, `($n::text)::enum` bind); `task_priority` is reused directly.
3. Story points ∈ {1,3,5,8} or NULL. Sprint capacity (>0) is a hard cap → **409 Conflict** on overflow.
4. At most one `active` sprint per user (DB partial unique index + service guard).
5. Ownership filter (`user_id = $n`) on every query; not-found ⇒ `AppError::NotFound`.
6. List endpoints for new modules return `{ data, total }`; single resources return flat objects; `204` on delete.
