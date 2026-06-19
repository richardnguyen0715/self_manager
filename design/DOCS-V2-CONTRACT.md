# DOCS V2 CONTRACT — Notion Parity MVP

Authoritative implementation contract for the Docs V2 build. Evolves the existing
Docs feature (Spaces + Pages, migration `0007_docs.sql`, `features/docs/*` with a
TipTap editor). Conventions: Rust/Axum modular monolith + SQLx (compile-time
checked `query!`/`query_as!`), enum-as-text + CHECK, `jsonb -> serde_json::Value`,
`AuthUser` ownership on every authed query, `.clone()` / `expr as Type` casts on
non-Copy binds. Frontend Next 15 / React 19 / TipTap v2 / TanStack Query / Zustand
/ Tailwind, built with Bun.

OUT OF SCOPE (do NOT build): collaboration/presence, AI assistant, automation,
calendar/timeline/gallery/list DB views, relation/rollup/formula/person/file
column types, custom domains.

---

## A. DOMAIN MODEL

### Page (EVOLVED — `page` module)
Existing columns kept: `id, space_id, parent_id, user_id, title, kind, content,
excalidraw, status, position, created_at, updated_at, published_at`.

**Added columns:**
| Field         | Type                  | Notes |
|---------------|-----------------------|-------|
| `icon`        | `text` nullable       | Emoji char (e.g. `"📄"`) or `null`. |
| `cover_url`   | `text` nullable       | `/uploads/<file>` or external URL. |
| `is_public`   | `boolean` NOT NULL default `false` | Publish-as-website flag. |
| `public_slug` | `text` nullable, UNIQUE | URL slug for `/p/<slug>`. Set when first made public; `null` when private. |
| `is_template` | `boolean` NOT NULL default `false` | Template pages are excluded from the normal tree and listed via the templates endpoint. |

Semantics:
- "Folder" = a page that has children (Notion model, no separate entity).
- `is_public` true requires a `public_slug`; the public subtree = this page plus
  all descendant pages where `is_public = true` (a child is only publicly visible
  if it is itself public). Publishing-public is independent of `status`
  (`draft`/`published`) which remains the internal version-snapshot lifecycle.

### PageLink (NEW — backlinks, in `page` module)
A directed edge written when an `@page` mention is created in a page's body.
| Field            | Type | Notes |
|------------------|------|-------|
| `id`             | uuid PK | |
| `source_page_id` | uuid FK pages ON DELETE CASCADE | The page containing the mention. |
| `target_page_id` | uuid FK pages ON DELETE CASCADE | The mentioned page. |
| `user_id`        | uuid FK users ON DELETE CASCADE | Owner (denormalized for ownership checks). |
| `created_at`     | timestamptz | |
UNIQUE `(source_page_id, target_page_id)`. Backlinks panel for page P =
`SELECT ... WHERE target_page_id = P`. Links are recomputed (delete-then-insert
for the source page) on every page content save that contains mentions.

### Database (NEW — `database` module)
A standalone collection of typed rows living in a Space; can also be embedded in a
page body via the `databaseEmbed` block (which stores only the database id).
| Field        | Type | Notes |
|--------------|------|-------|
| `id`         | uuid PK | |
| `space_id`   | uuid FK spaces ON DELETE CASCADE | |
| `user_id`    | uuid FK users ON DELETE CASCADE | Ownership. |
| `title`      | text NOT NULL default `'Untitled Database'` | |
| `icon`       | text nullable | Emoji. |
| `created_at` / `updated_at` | timestamptz | |

### DatabaseColumn (NEW)
| Field        | Type | Notes |
|--------------|------|-------|
| `id`         | uuid PK | Used as the key inside `DatabaseRow.values`. |
| `database_id`| uuid FK databases ON DELETE CASCADE | |
| `name`       | text NOT NULL | |
| `type`       | text NOT NULL CHECK in (`text`,`number`,`date`,`checkbox`,`select`,`multi_select`,`status`,`url`) | |
| `options`    | jsonb NOT NULL default `'[]'` | For `select`/`multi_select`/`status`: array of `{ id, name, color }`. Empty for scalar types. |
| `position`   | int NOT NULL default 0 | Display order. |
| `created_at` | timestamptz | |

### DatabaseRow (NEW)
| Field        | Type | Notes |
|--------------|------|-------|
| `id`         | uuid PK | |
| `database_id`| uuid FK databases ON DELETE CASCADE | |
| `values`     | jsonb NOT NULL default `'{}'` | Map keyed by **column id** → typed value. `text`/`url`→string, `number`→number, `date`→ISO string, `checkbox`→bool, `select`/`status`→option id (string), `multi_select`→array of option ids. Missing key = empty. |
| `position`   | int NOT NULL default 0 | Manual ordering / fallback. |
| `created_at` / `updated_at` | timestamptz | |

### DatabaseView (NEW)
| Field         | Type | Notes |
|---------------|------|-------|
| `id`          | uuid PK | |
| `database_id` | uuid FK databases ON DELETE CASCADE | |
| `name`        | text NOT NULL | |
| `type`        | text NOT NULL CHECK in (`table`,`board`) | |
| `config`      | jsonb NOT NULL default `'{}'` | See shape below. |
| `position`    | int NOT NULL default 0 | Tab order. |
| `created_at` / `updated_at` | timestamptz | |

`config` jsonb shape (all optional):
```jsonc
{
  "group_by_column_id": "uuid",      // board only; must be a select|status column
  "filters": [                        // AND-combined
    { "column_id": "uuid", "op": "eq|neq|contains|gt|lt|is_empty|is_not_empty", "value": <json> }
  ],
  "sorts": [
    { "column_id": "uuid", "direction": "asc|desc" }
  ],
  "column_order": ["uuid", ...],     // table only
  "hidden_column_ids": ["uuid", ...] // table only
}
```

---

## B. DDL — `migrations/0008_docs_v2.sql`

Additive; `gen_random_uuid()`, `timestamptz`, FKs `ON DELETE CASCADE`,
enum-as-text + CHECK, `pg_trgm` GIN. (`CREATE EXTENSION IF NOT EXISTS pg_trgm`
already in 0007 — re-assert idempotently.)

```sql
-- =============================================================================
-- Migration: 0008_docs_v2.sql  (Notion parity: page meta, backlinks, databases)
-- Additive. enum-as-text + CHECK. jsonb blobs. FKs ON DELETE CASCADE.
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── pages: new Notion-parity columns ────────────────────────────────────────
ALTER TABLE pages ADD COLUMN IF NOT EXISTS icon        text;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS cover_url   text;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS is_public   boolean NOT NULL DEFAULT false;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS public_slug text;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pages_public_slug
    ON pages (public_slug) WHERE public_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pages_public ON pages (is_public) WHERE is_public;
CREATE INDEX IF NOT EXISTS idx_pages_template
    ON pages (space_id) WHERE is_template;

-- ── page_links (backlinks graph) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS page_links (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    source_page_id uuid        NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    target_page_id uuid        NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    user_id        uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source_page_id, target_page_id)
);
CREATE INDEX IF NOT EXISTS idx_page_links_target ON page_links (target_page_id);
CREATE INDEX IF NOT EXISTS idx_page_links_source ON page_links (source_page_id);

-- ── databases ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS databases (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id   uuid        NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    user_id    uuid        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    title      text        NOT NULL DEFAULT 'Untitled Database',
    icon       text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_databases_space ON databases (space_id);
CREATE INDEX IF NOT EXISTS idx_databases_user  ON databases (user_id);
CREATE INDEX IF NOT EXISTS idx_databases_title_trgm
    ON databases USING gin (title gin_trgm_ops);

-- ── database_columns ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS database_columns (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    database_id uuid        NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
    name        text        NOT NULL,
    type        text        NOT NULL
                    CHECK (type IN ('text','number','date','checkbox',
                                    'select','multi_select','status','url')),
    options     jsonb       NOT NULL DEFAULT '[]'::jsonb,
    position    int         NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_database_columns_db
    ON database_columns (database_id, position);

-- ── database_rows ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS database_rows (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    database_id uuid        NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
    values      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    position    int         NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_database_rows_db
    ON database_rows (database_id, position);
CREATE INDEX IF NOT EXISTS idx_database_rows_values
    ON database_rows USING gin (values jsonb_path_ops);

-- ── database_views ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS database_views (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    database_id uuid        NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
    name        text        NOT NULL,
    type        text        NOT NULL CHECK (type IN ('table','board')),
    config      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    position    int         NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_database_views_db
    ON database_views (database_id, position);
```

> SQLx note: bind enum-as-text columns as `String`/`&str`; read jsonb via
> `col AS "values: serde_json::Value"`. On INSERT/UPDATE pass `serde_json::Value`
> binds directly (clone non-Copy values that are reused). Booleans are Copy.

---

## C. REST ENDPOINT MAP

Mounting in `main.rs` (additive to existing `.nest` block):
```rust
.nest("/databases", modules::database::router())   // AUTHED (AuthUser)
.nest("/docs",       modules::doc_search::router()) // AUTHED → /api/docs/search
.nest("/public",     modules::public_docs::router()) // NO AuthUser extractor
```
`page` router gains the new routes below (still merged with `doc_comment` under
`/api/pages`). `public_docs` handlers use **no** `AuthUser`; ownership is replaced
by an `is_public = true` predicate in SQL.

### Page additions (`/api/pages`, AUTHED)
| Method | Path | Body / Query | Response |
|--------|------|--------------|----------|
| PATCH  | `/:id` (EVOLVED) | adds `icon?`, `cover_url?` to existing `UpdatePageRequest` | `Page` |
| POST   | `/:id/public` | `{ "public": bool }` | `{ "is_public": bool, "public_slug": string\|null }` — toggling true mints a unique slug (from title, deduped) if none; toggling false keeps slug but sets `is_public=false` |
| POST   | `/:id/cover` | `multipart/form-data` field `file` (image) | `{ "url": "/uploads/<file>" }` (sets `cover_url`) |
| GET    | `/templates` | `?space_id=<uuid>` (optional) | `Page[]` where `is_template = true` (literal segment, register before `/:id`) |
| POST   | `/from-template` | `{ "space_id": uuid, "parent_id"?: uuid, "template_id": uuid, "title"?: string }` | `Page` — deep-copies template `content` into a new page |
| GET    | `/:id/backlinks` | — | `PageBacklink[]` = `{ source_page_id, title, space_id }` (pages mentioning this page) |
| GET    | `/:id/links` | — | `PageLinkRef[]` outbound links (optional, for editor validation) |

> Backlink writes: there is **no** dedicated link endpoint. `PATCH /:id` (content
> save) re-syncs `page_links` for that source page server-side: it extracts all
> `pageMention` node `pageId` attrs from the saved TipTap JSON, then performs
> delete-all-for-source + insert-distinct. Idempotent.

### Databases (`/api/databases`, AUTHED) — literal segments before `/:id`
| Method | Path | Body / Query | Response |
|--------|------|--------------|----------|
| GET    | `/` | `?space_id=<uuid>` (required) | `Database[]` |
| POST   | `/` | `{ space_id, title?, icon? }` | `Database` — seeds 1 `text` column ("Name") + 1 default `table` view |
| GET    | `/:id` | — | `DatabaseDetail` = `{ database, columns[], views[] }` |
| PATCH  | `/:id` | `{ title?, icon? }` | `Database` |
| DELETE | `/:id` | — | `204` |
| GET    | `/:id/columns` | — | `DatabaseColumn[]` |
| POST   | `/:id/columns` | `{ name, type, options?, position? }` | `DatabaseColumn` |
| PATCH  | `/:id/columns/:colId` | `{ name?, type?, options?, position? }` (retype allowed) | `DatabaseColumn` |
| DELETE | `/:id/columns/:colId` | — | `204` (also strips key from every row's `values`) |
| GET    | `/:id/rows` | — | `DatabaseRow[]` (raw, position order) |
| POST   | `/:id/rows` | `{ values?: object, position? }` | `DatabaseRow` |
| PATCH  | `/:id/rows/:rowId` | `{ values?: object (shallow-merged), position? }` | `DatabaseRow` |
| PATCH  | `/:id/rows` | `{ updates: [{ id, values }] }` (batch value update — used by Board drag) | `DatabaseRow[]` |
| DELETE | `/:id/rows/:rowId` | — | `204` |
| GET    | `/:id/views` | — | `DatabaseView[]` |
| POST   | `/:id/views` | `{ name, type, config?, position? }` | `DatabaseView` |
| PATCH  | `/:id/views/:viewId` | `{ name?, config?, position? }` | `DatabaseView` |
| DELETE | `/:id/views/:viewId` | — | `204` |
| GET    | `/:id/views/:viewId/rows` | `?` (uses stored view config; optional `filter`/`sort` overrides ignored in MVP) | **Table:** `{ rows: DatabaseRow[] }` filtered+sorted server-side. **Board:** `{ groups: [{ option_id: string\|null, option_name: string, rows: DatabaseRow[] }] }` grouped by `config.group_by_column_id` (server-side grouping; ungrouped rows under `option_id: null` = "No <column>"). |

> Filter/sort/group are applied **server-side** in `GET /:id/views/:viewId/rows`
> by reading the view's stored `config`. Filtering uses jsonb `values->>'<colId>'`
> comparisons; sorting orders by the typed extraction; board grouping buckets by
> the group column's option id. The plain `GET /:id/rows` returns unprocessed rows
> for editing grids that apply their own client-side logic.

### Search (`/api/docs`, AUTHED)
| Method | Path | Query | Response |
|--------|------|-------|----------|
| GET    | `/search` | `q` (required), `space_id?` | `{ pages: PageSearchHit[], databases: DatabaseSearchHit[] }` |

- `PageSearchHit = { id, space_id, title, icon, snippet }` — matches page `title`
  (pg_trgm) OR plaintext extracted from `content` jsonb (`content::text ILIKE`),
  scoped to `user_id`.
- `DatabaseSearchHit = { id, space_id, title, icon, matched_rows: int }` — matches
  database `title` (pg_trgm) OR any row `values::text ILIKE`, scoped to `user_id`.

### Public (`/api/public`, UNAUTHENTICATED — no `AuthUser`)
| Method | Path | Response |
|--------|------|----------|
| GET    | `/pages/:slug` | `PublicPage` = `{ id, title, icon, cover_url, content, updated_at, children: PublicPageRef[] }` where the page is `is_public = true` AND matches `public_slug = :slug`; `children` = direct child pages that are also `is_public = true` (`{ id, title, icon, public_slug }`). 404 if not found or not public. **No ownership filter.** |
| GET    | `/pages/:slug/tree` | `PublicPageTreeNode[]` — full public descendant subtree (id, title, icon, public_slug, children) for site navigation. |

---

## D. EDITOR (TipTap v2, React 19)

### Full extension list registered in `DocEditor.tsx`
Existing (keep): `StarterKit` (incl bold/italic/strike/code/blockquote/heading/
bulletList/orderedList/codeBlock/horizontalRule), `Underline`, `TextAlign`,
`TaskList`, `TaskItem`, `Table`+`TableRow`+`TableHeader`+`TableCell`, `Image`,
`Link`, `Placeholder`, `Mention`, `CharacterCount`, `CodeBlockLowlight`,
`GlobalDragHandle`, `AutoJoiner`, custom `InfoPanel` (callout base), `Columns`/
`Column`, `Mermaid`, `TableOfContents`, slash `Suggestion`.

**New nodes/marks (editor agent, under `editor/extensions/` + `node-views/`):**
| Extension | Source | Notes |
|-----------|--------|-------|
| `Highlight` | `@tiptap/extension-highlight` (npm) | rich-text mark; `multicolor: true`. |
| `Youtube` (video) | `@tiptap/extension-youtube` (npm) | YouTube/video embeds via slash `/video`. |
| `Toggle` (collapsible) | custom node (details/summary) | Renders summary + collapsible content; React node-view `ToggleView.tsx`. (No stable React-19 official details pkg — implement as a custom `Node` with `content: 'block+'`.) |
| `Callout` | reuse/extend existing `InfoPanel` | Map Notion "callout" → `infoPanel` variants; add emoji attr. |
| `Bookmark` | custom atom node | Stores `{ href, title?, description?, image? }`; `BookmarkView.tsx` renders link preview card. Slash `/bookmark`. |
| `Embed` (iframe) | custom atom node | Stores `{ src }`; sandboxed `<iframe>`; slash `/embed`. |
| `PageMention` | custom Mention-config (`@page`) | Inline atom storing `{ pageId, label }`; renders link to `/docs/page/:pageId`; selecting writes a `page_links` row (see below). |
| `DatabaseEmbed` | custom atom node | Stores **only** `{ databaseId }`; lazy node-view `DatabaseEmbedView.tsx` that dynamically imports `DatabaseEmbed` from `@/features/docs/database` and renders the live `DatabaseView`. Slash `/database`. |

**Block ops (editor agent):** "turn into" (convert block type) + "duplicate block"
exposed in the block gutter menu and via slash. Nest/drag already exist.

### npm deps to add (React-19 compatible, TipTap v2.11.x to match lockfile)
```
@tiptap/extension-highlight@^2.11.0
@tiptap/extension-youtube@^2.11.0
```
`Toggle`, `Callout`, `Bookmark`, `Embed`, `DatabaseEmbed`, `PageMention` are
**custom** (no extra deps; built on `@tiptap/core` + `@tiptap/react`
`ReactNodeViewRenderer`, already present). No `@tiptap/extension-details` (its
React-19 status is unstable) — Toggle is hand-rolled.

### databaseEmbed storage in the doc
The node serializes as:
```json
{ "type": "databaseEmbed", "attrs": { "databaseId": "<uuid>" } }
```
Only the id is stored in the page `content` jsonb. The node-view fetches the
database live via `useDatabase(databaseId)`; deleting the database leaves a
graceful "database not found" placeholder.

### @page mention → page link resolution
1. Typing `@` opens a Mention suggestion list backed by `useSearchPages(q)`.
2. Selecting a page inserts a `pageMention` node `{ pageId, label }`.
3. On the next page autosave (`PATCH /api/pages/:id`), the **backend** parses the
   saved `content` jsonb, collects all `pageMention.attrs.pageId` values, and
   re-syncs `page_links` for the source page (delete-for-source + insert-distinct,
   ownership-checked). No separate client call is required — backlinks stay
   consistent with the persisted document.

---

## E. FRONTEND

### TS types to add (`src/types/index.ts`)
```ts
// Page additions on existing Page / PageTreeNode interfaces:
//   icon: string | null; cover_url: string | null;
//   is_public: boolean; public_slug: string | null; is_template: boolean;
// (add to PageSearchResult too: icon, snippet?)

export interface PageBacklink { source_page_id: string; title: string; space_id: string; }
export interface PagePublicState { is_public: boolean; public_slug: string | null; }

export type DatabaseColumnType =
  | "text" | "number" | "date" | "checkbox"
  | "select" | "multi_select" | "status" | "url";
export interface SelectOption { id: string; name: string; color: string; }
export interface Database { id: string; space_id: string; user_id: string;
  title: string; icon: string | null; created_at: string; updated_at: string; }
export interface DatabaseColumn { id: string; database_id: string; name: string;
  type: DatabaseColumnType; options: SelectOption[]; position: number; created_at: string; }
export interface DatabaseRow { id: string; database_id: string;
  values: Record<string, unknown>; position: number; created_at: string; updated_at: string; }
export type DatabaseViewType = "table" | "board";
export interface ViewFilter { column_id: string;
  op: "eq"|"neq"|"contains"|"gt"|"lt"|"is_empty"|"is_not_empty"; value?: unknown; }
export interface ViewSort { column_id: string; direction: "asc"|"desc"; }
export interface DatabaseViewConfig {
  group_by_column_id?: string; filters?: ViewFilter[]; sorts?: ViewSort[];
  column_order?: string[]; hidden_column_ids?: string[]; }
export interface DatabaseView { id: string; database_id: string; name: string;
  type: DatabaseViewType; config: DatabaseViewConfig; position: number;
  created_at: string; updated_at: string; }
export interface DatabaseDetail { database: Database; columns: DatabaseColumn[]; views: DatabaseView[]; }
export interface BoardGroup { option_id: string | null; option_name: string; rows: DatabaseRow[]; }
export interface ViewRowsResponse { rows?: DatabaseRow[]; groups?: BoardGroup[]; }
export interface DocSearchResult {
  pages: { id: string; space_id: string; title: string; icon: string | null; snippet: string }[];
  databases: { id: string; space_id: string; title: string; icon: string | null; matched_rows: number }[];
}
export interface PublicPageRef { id: string; title: string; icon: string | null; public_slug: string | null; }
export interface PublicPage { id: string; title: string; icon: string | null;
  cover_url: string | null; content: TipTapDoc; updated_at: string; children: PublicPageRef[]; }
```

### API_ENDPOINTS keys to add (`src/types/index.ts`)
```ts
// Page additions
PAGE_PUBLIC:        (id) => `/api/pages/${id}/public`,
PAGE_COVER:         (id) => `/api/pages/${id}/cover`,
PAGES_TEMPLATES:    "/api/pages/templates",
PAGE_FROM_TEMPLATE: "/api/pages/from-template",
PAGE_BACKLINKS:     (id) => `/api/pages/${id}/backlinks`,
// Databases
DATABASES:          "/api/databases",
DATABASE_BY_ID:     (id) => `/api/databases/${id}`,
DATABASE_COLUMNS:   (id) => `/api/databases/${id}/columns`,
DATABASE_COLUMN_BY_ID: (id, cid) => `/api/databases/${id}/columns/${cid}`,
DATABASE_ROWS:      (id) => `/api/databases/${id}/rows`,
DATABASE_ROW_BY_ID: (id, rid) => `/api/databases/${id}/rows/${rid}`,
DATABASE_VIEWS:     (id) => `/api/databases/${id}/views`,
DATABASE_VIEW_BY_ID:(id, vid) => `/api/databases/${id}/views/${vid}`,
DATABASE_VIEW_ROWS: (id, vid) => `/api/databases/${id}/views/${vid}/rows`,
// Search
DOCS_SEARCH:        "/api/docs/search",
// Public (unauth)
PUBLIC_PAGE:        (slug) => `/api/public/pages/${slug}`,
PUBLIC_PAGE_TREE:   (slug) => `/api/public/pages/${slug}/tree`,
```

### File-ownership split
- **foundation:** `package.json` (add 2 tiptap deps), `types/index.ts` (all V2
  types + API_ENDPOINTS), `features/docs/hooks/useDocs.ts` (ALL new hooks:
  page icon/cover/public/templates/backlinks; databases CRUD + columns + rows +
  views + view-rows; docs search; public page — add `docsKeys.databases.*`,
  `docsKeys.search`, `docsKeys.public.*`), nav entries if needed.
- **editor agent:** `features/docs/editor/*` — new block extensions (Toggle,
  Callout, Bookmark, Embed, Youtube/video, Highlight mark, `DatabaseEmbed` node
  that lazy-imports `DatabaseEmbed` from `features/docs/database`), `@page`
  PageMention suggestion, "turn into" / duplicate-block gutter menu, extended
  slash items. Owns `DocEditor` extension registration + `editor/index.ts` exports.
- **page-meta agent:** `features/docs/pages/*` + page editor route header — emoji
  icon picker (reuse `EmojiPicker`), cover image upload/positioning, templates
  picker on new-page (uses `PAGES_TEMPLATES` + `PAGE_FROM_TEMPLATE`), public-site
  toggle UI showing the public URL, backlinks panel (`PAGE_BACKLINKS`). Imports
  editor for the body.
- **database agent:** `features/docs/database/*` — `DatabaseView` (Table + Board
  tabs via `@radix-ui/react-tabs`), `TableView` (inline edit, add/rename/retype
  columns, add rows, filter/sort UI), `BoardView` (dnd via `@dnd-kit`, drag card
  between groups → `PATCH /:id/rows` batch updating the group column value),
  column-type manager, row editor. Standalone route `app/docs/db/[id]`. Exports a
  `DatabaseEmbed` component (props `{ databaseId }`) for the editor node.
- **search agent:** `features/docs/search/*` — extend the ⌘K command palette
  (cmdk) to query `DOCS_SEARCH` (debounced) and list pages + databases with
  navigation; section grouping. (Fallback `/docs/search` screen optional.)
- **public agent:** `app/p/[slug]/page.tsx` (+ layout) — server component fetches
  `PUBLIC_PAGE`, renders TipTap JSON read-only via `DocView` (from
  `features/docs/editor`), **no** `AppShell`/auth chrome; SEO `metadata`
  (`generateMetadata` from title/icon); renders public child nav from `children`.

### Routes to add
- `app/docs/db/[id]/page.tsx` — standalone database view (authed, inside AppShell).
- `app/p/[slug]/page.tsx` — public read-only site renderer (no auth, no AppShell).

### Search integration approach
Extend the existing global ⌘K command palette (cmdk) to call `useDocsSearch(q)`
(debounced ~250ms) hitting `GET /api/docs/search`, rendering two sections — Pages
(→ `/docs/page/:id`) and Databases (→ `/docs/db/:id`). No separate screen required
for MVP.

---

## SUMMARY

- **Migration `0008_docs_v2.sql`**: ALTER `pages` (+icon, cover_url, is_public,
  public_slug UNIQUE, is_template); CREATE `page_links`, `databases`,
  `database_columns`, `database_rows`, `database_views`; FKs CASCADE; pg_trgm GIN
  on `pages.title` (exists) + `databases.title`; CHECK on column type & view type.
- **Backend**: EVOLVE `page` (icon/cover/public toggle minting slug/templates/
  from-template/backlinks + content-save link re-sync); NEW `database` (full CRUD
  for db/columns/rows incl batch + views + server-side filter/sort/board-group in
  `views/:viewId/rows`); NEW `doc_search` (`/api/docs/search` pages+databases);
  NEW `public_docs` (`/api/public/pages/:slug` UNAUTHENTICATED via `is_public`
  predicate, no `AuthUser`). Mount: `/databases`, `/docs`, `/public`.
- **Editor**: add `Highlight` + `Youtube` npm deps; custom Toggle, Bookmark,
  Embed, Callout(=InfoPanel), `DatabaseEmbed` (stores only `databaseId`, lazy-
  renders DatabaseView), `@page` PageMention (backlinks synced on save). Turn-into
  + duplicate block ops.
- **Frontend**: foundation owns types + endpoints + hooks; agents split across
  editor / page-meta / database / search / public; new routes `app/docs/db/[id]`
  and `app/p/[slug]`; ⌘K palette extended for docs search.
- **Server-side** filter/sort/group live in `GET /databases/:id/views/:viewId/rows`
  (table→`{rows}`, board→`{groups}`); board drag uses batch `PATCH /:id/rows`.
