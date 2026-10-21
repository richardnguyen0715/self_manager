# Retro system — periodic reviews & retrospectives linked to any object

Status: design + contract for implementation (migration 0021, module `retro`, route `/retros`).
Research basis: Parabol (single meeting table + type discriminator, templates as prompt rows, tasks as action sink), Plane (join tables for membership, frozen `progress_snapshot`), Obsidian Periodic Notes (period key, lazy creation on open), retro-board (templates/columns), GTD weekly review.

## 1. Goals

1. One system for **daily / weekly / monthly / quarterly / yearly** reviews and **scoped retros** (sprint, project, epic, initiative, goal, work item, habit).
2. A retro can **link to any number of objects** (work items, sprints, projects, epics, goals, habits, docs, other retros) with a relation (`about`, `evidence`, `action_source`, `mentions`). Backlinks: from any object you can list retros that mention it.
3. **Templates** with ordered prompt sections of several input types (text cards, rating, mood, checklist, auto-metric block). Built-in templates seeded; user can create/edit own.
4. **Auto context**: a snapshot of metrics for the period/scope (completed work items, points, habit completion rate, focus minutes, overdue, sprint velocity) frozen on completion (Plane snapshot idea).
5. **Action items** with carry-over to the next retro of the same kind+scope and one-click conversion to a work item.
6. Timeline + trends (rating/mood/completed items/habit rate over time).
7. Keep legacy `sprint_reviews` / `retrospectives` tables & endpoints untouched; legacy sprint retros are **backfilled** into the new tables (kind `sprint`).

## 2. Data model (migration `0021_retros.sql`, idempotent)

Prefix `retro_` to avoid clashing with legacy `retrospectives`.

```
retro_templates
  id uuid pk default gen_random_uuid()
  user_id uuid null refs users on delete cascade      -- null = built-in (visible to all)
  name text not null
  kind text not null check (kind in ('daily','weekly','monthly','quarterly','yearly','sprint','project','custom'))
  description text
  is_builtin boolean not null default false
  created_at, updated_at timestamptz default now()

retro_template_sections
  id uuid pk, template_id uuid refs retro_templates on delete cascade
  position int not null, key text not null, title text not null, prompt text
  input_type text not null check (input_type in ('cards','text','rating','mood','checklist','auto_metrics'))
  auto_source text null  -- for auto_metrics: 'completed_items'|'habits'|'focus'|'sprint'|'overdue'|'all'
  unique (template_id, key)

retros
  id uuid pk
  user_id uuid not null refs users on delete cascade
  template_id uuid null refs retro_templates on delete set null
  kind text not null (same check as templates)
  title text not null
  period_start date not null, period_end date not null
  scope_type text not null default 'none' check (scope_type in ('none','sprint','project','epic','initiative','goal','work_item','habit'))
  scope_id uuid null
  status text not null default 'draft' check (status in ('draft','completed'))
  rating smallint null check (rating between 1 and 5)
  mood smallint null check (mood between 1 and 5)
  summary text
  snapshot jsonb not null default '{}'
  started_at timestamptz default now(), completed_at timestamptz null
  created_at, updated_at
  unique index (user_id, kind, period_start, scope_type, coalesce(scope_id,'00000000-0000-0000-0000-000000000000'))
  index (user_id, kind, period_start desc), index (scope_type, scope_id)

retro_sections            -- per-retro COPY of template sections (history stays readable when template changes)
  id uuid pk, retro_id uuid refs retros on delete cascade
  position int, key text, title text, prompt text, input_type text, auto_source text

retro_entries
  id uuid pk, retro_id uuid refs retros on delete cascade, section_id uuid refs retro_sections on delete cascade
  position int not null default 0, body text not null default ''
  rating smallint null, mood smallint null, checked boolean not null default false
  created_at, updated_at

retro_links               -- polymorphic link, one table, no FK on target (validated in service)
  id uuid pk, retro_id uuid refs retros on delete cascade
  target_type text not null check (target_type in ('work_item','sprint','project','epic','initiative','goal','habit','doc','retro'))
  target_id uuid not null
  relation text not null default 'about' check (relation in ('about','evidence','action_source','mentions'))
  created_at
  unique (retro_id, target_type, target_id, relation)
  index (target_type, target_id)

retro_actions
  id uuid pk, retro_id uuid refs retros on delete cascade
  user_id uuid not null refs users
  text text not null, status text not null default 'open' check (status in ('open','done','dropped'))
  due_date date null
  work_item_id uuid null refs work_items on delete set null    -- set when converted
  carried_from_action_id uuid null refs retro_actions on delete set null
  carry_count int not null default 0
  position int default 0, created_at, updated_at, completed_at
  index (user_id, status)
```

Seed built-in templates (`user_id NULL, is_builtin true`) in the migration with `ON CONFLICT DO NOTHING` (use a fixed uuid or `WHERE NOT EXISTS (select 1 from retro_templates where is_builtin and name=...)`):

| name | kind | sections (key: input_type) |
|---|---|---|
| Daily check-in | daily | context: auto_metrics(all); mood: mood; wins: cards; blockers: cards; tomorrow: checklist ("Top 3 for tomorrow") |
| Weekly review | weekly | context: auto_metrics(all); rating: rating; wins: cards; misses: cards; lessons: cards; next_week: checklist; habits: text |
| Monthly review | monthly | context: auto_metrics(all); rating; goals: text; wins: cards; drop: cards ("What to stop/drop"); focus_next: checklist |
| Quarterly review | quarterly | context; rating; objectives: text; wins; lessons; bets_next: checklist |
| Yearly review | yearly | context; rating; highlights: cards; lessons: cards; themes_next: text |
| Sprint retro | sprint | context: auto_metrics(sprint); went_well: cards; start: cards; stop: cards; continue: cards |
| Project retro (4Ls) | project | context: auto_metrics(all); liked: cards; learned: cards; lacked: cards; longed_for: cards |

Backfill (same migration): for each row in legacy `retrospectives` insert a `retros` row (kind `sprint`, scope sprint, period = sprint start/end, status `completed`, title `Retro — <sprint name>`), sections copied from the Sprint retro template, entries for `went_well` (section went_well) and `went_wrong` (section stop), each `action_items` jsonb element (string or object with `text`) into `retro_actions`. Skip rows already backfilled (guard via `NOT EXISTS` on the unique key). Wrap in DO block; must not fail if legacy columns hold odd json.

## 3. Period rules (single function, `service::period_for(kind, date)`)

- daily: [d, d]
- weekly: Monday..Sunday containing d (ISO)
- monthly: first..last day of month
- quarterly: calendar quarter; yearly: Jan 1..Dec 31
- sprint (scope_type sprint): sprint.start_date..end_date (use the sprint columns; read them)
- project/custom/other scopes: [d, d] unless caller passes `period_end`
- Title default: daily `Daily — 2026-10-19`, weekly `Week 43, 2026`, monthly `October 2026`, quarterly `Q4 2026`, yearly `2026`, scoped `<Kind> retro — <scope label>`.

## 4. API (all under `/api/retros`, AuthUser, runtime `sqlx::query`; errors via AppError)

Register static routes before `/:id` routes.

```
GET    /templates                      -> Template[] (own + builtin), each with sections[]
POST   /templates                      {name, kind, description?, sections:[{key,title,prompt?,input_type,auto_source?}]}
PATCH  /templates/:id                  {name?, description?, sections?}   (own only; sections = full replace)
DELETE /templates/:id                  (own only, not builtin)

POST   /open                           {kind, date?:'YYYY-MM-DD', scope_type?, scope_id?, template_id?, title?}
                                        -> RetroDetail  (idempotent: ON CONFLICT returns existing; on create: copy template sections,
                                           carry over open actions from previous retro of same kind+scope with carry_count+1, auto-link scope object
                                           as relation 'about', compute live snapshot)
GET    /                               ?kind=&scope_type=&scope_id=&status=&from=&to=&limit=&offset=  -> {data: RetroSummary[], total}
GET    /trends                         ?kind=weekly&limit=12 -> TrendPoint[]
GET    /by-target                      ?target_type=&target_id= -> RetroSummary[]  (retros linking to it OR scoped to it)
GET    /actions                        ?status=open -> ActionWithRetro[]
GET    /:id                            -> RetroDetail
PATCH  /:id                            {title?, summary?, rating?, mood?}
DELETE /:id
POST   /:id/refresh-snapshot           (draft only) -> RetroDetail
POST   /:id/complete                   freeze snapshot, status completed -> RetroDetail
POST   /:id/reopen                     -> RetroDetail

POST   /:id/entries                    {section_id, body?, rating?, mood?, checked?, position?} -> Entry
PATCH  /entries/:entry_id              {body?, rating?, mood?, checked?, position?} -> Entry
DELETE /entries/:entry_id

POST   /:id/links                      {target_type, target_id, relation?} -> LinkResolved   (target must exist & belong to user; dedupe)
DELETE /links/:link_id

POST   /:id/actions                    {text, due_date?} -> Action
PATCH  /actions/:action_id             {text?, status?, due_date?} -> Action  (status done => completed_at)
DELETE /actions/:action_id
POST   /actions/:action_id/convert     -> Action  (creates work_items row: type 'task', status 'backlog', title=text, project_id = retro scope project if scope_type project, due_date; sets work_item_id; idempotent if already converted)
```

JSON shapes (snake_case):

```
RetroSummary { id, kind, title, period_start, period_end, scope_type, scope_id, scope_label|null, status,
               rating|null, mood|null, entries_count, links_count, open_actions, completed_at|null }
RetroDetail  { retro: RetroSummary & {template_id, summary, snapshot, started_at, created_at, updated_at},
               sections: [{id, position, key, title, prompt, input_type, auto_source}],
               entries:  [{id, section_id, position, body, rating, mood, checked}],
               links:    [LinkResolved], actions: [Action] }
LinkResolved { id, target_type, target_id, relation, title|null, subtitle|null (e.g. status or key), href|null (frontend path) }
Action       { id, retro_id, text, status, due_date, work_item_id|null, carried_from_action_id|null, carry_count, completed_at }
ActionWithRetro = Action & { retro_title, retro_kind, retro_period_start }
TrendPoint   { retro_id, period_start, title, rating, mood, completed_items, completed_points, habit_rate, focus_minutes }
Snapshot (jsonb) {
  range: {from, to},
  completed_items: {count, points, by_type: {task: n,...}, items: [{id,title,key?}] (max 20)},
  overdue: {count},
  habits: {rate (0..1) | null, logged_days, streaks: [{habit_id,name,streak}] (max 5)},
  focus: {minutes, sessions},
  sprint: {id,name,committed_points,completed_points,velocity} | null,   // when scope sprint
  scope: {type,id,label,total_items,done_items} | null                    // when scope project/epic/goal
}
```

scope_label & link resolution: `work_item` → title (subtitle status, href `/work-items/<id>`), `sprint` → name (`/sprints/<id>`), `project` → name (`/projects`), `epic`/`initiative`/`goal` → title (`/goals`), `habit` → name (`/habits`), `doc` → pages.title (`/docs/<id>` — check the docs route), `retro` → title (`/retros/<id>`). Read the real table/column names from migrations before writing SQL.

Snapshot sources: `work_items` (completed_at in range, deleted_at IS NULL, scoped by sprint_id/epic_id/project_id when scope applies), `habit_logs`/`habits`, `focus_sessions`, `sprints`. Read real columns first.

## 5. Frontend (Next.js feature `frontend/src/features/retros/`, routes `/retros`, `/retros/[id]`, `/retros/trends`)

- **/retros**: header with quick buttons "Today's check-in", "This week", "This month", "New scoped retro…"; cadence tabs (All, Daily, Weekly, Monthly, Quarterly, Yearly, Sprint, Project); timeline list of RetroSummary (title, period, status chip, rating/mood dots, open-actions badge, scope chip); filter by status; link to Trends; side card "Open actions" (from /actions, carry badge, convert button).
- **/retros/[id]**: single scrollable page. Header (editable title, period, status, rating 1–5 / mood 1–5 inputs, Complete/Reopen). Context block (snapshot cards) for `auto_metrics` sections + "Refresh" while draft. Sections by `input_type`: `cards` = list of editable cards with add/delete; `text` = one autosaving textarea (single entry); `rating`/`mood` = star/emoji selector (stored on retro or entry); `checklist` = checkable lines. Debounced autosave (600ms). "Linked" panel: chips with icon+title (click navigates), "Link object" popover with type tabs + search (use existing list/search hooks for work items, sprints, projects, epics, goals, habits; docs via docs search if simple). "Actions" panel: add, status toggle, due date, "Convert to work item" (then shows key/link), carry badge "carried ×n".
- **/retros/trends**: cadence select; simple Recharts line chart (rating & completed items) + list of repeatedly carried actions. Use existing chart components pattern in features/analytics or reviews.
- Sidebar: item "Retros" under Insights (`/retros`), add to `HIDEABLE_NAV_ITEMS`; shortcut `g r`; command palette entries "Open today's check-in" / "Open this week's review".
- Integrations: sprint detail page → "Retro" button (open scope sprint) + list of linked retros; work item detail → "Retros" section (by-target backlinks + "Add to this week's review" quick action: opens weekly retro and links item as `mentions`); project/epic/goal cards optional.

## 6. Non-goals

Voting, anonymity, realtime co-editing, meeting phases/timers, AI grouping (can be added later; store suggestions separately).
