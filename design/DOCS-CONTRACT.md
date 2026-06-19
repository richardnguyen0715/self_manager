# DOCS-CONTRACT.md — Confluence-style Docs feature

Canonical, binding contract for the Docs feature of `manage-my-life`. All agents
(foundation, editor, shell, routes, collab, whiteboard) MUST conform to the
entity fields, DDL, endpoint paths, content model, dependency versions, and
file-ownership boundaries defined here. This file is the single source of truth;
when in doubt, this document wins.

Conventions inherited from the existing codebase (do not deviate):
- Backend: modular monolith. Each module dir under `backend/src/modules/<name>/`
  has `mod.rs` (declares `mod handlers; pub mod models; mod routes; pub mod service;`
  and `pub use routes::router;`), `routes.rs` (`pub fn router() -> Router<AppState>`),
  `handlers.rs` (thin: extract → `body.validate()` → `service::*` → respond),
  `models.rs` (sqlx `FromRow` structs + `Deserialize/Validate` request DTOs),
  `service.rs` (SQLx queries).
- Auth: every handler takes `auth: AuthUser` (Bearer JWT extractor). All rows are
  scoped by `user_id = auth.user_id`. 404 when a row belongs to another user.
- Enum-as-text pattern: store status/kind as Postgres `text` with a `CHECK`
  constraint (NOT a native enum, to stay additive and migration-safe). SELECT as
  plain text; bind as plain text. Serde serialises lowercase snake_case values.
- IDs `uuid DEFAULT gen_random_uuid()`; timestamps `timestamptz DEFAULT now()`.
- Errors via `AppError` / `AppResult`; validation via the `validator` crate.
- Uploads: files written to `backend/uploads/`, served statically at `/uploads`.
  Reuse the same multipart approach as `work_item::create_attachment` (field
  name `file`, returns a stored URL `/uploads/<file>`).
- Frontend: `@/lib/api.ts` client + `@tanstack/react-query`; endpoints centralised
  in `@/types` `API_ENDPOINTS`; types in `@/types`. Sidebar nav in
  `components/layout/sidebar.tsx` (`NAV_ITEMS`). Built with Bun, Next 15.1, React 19.

---

## A. Domain entities + relationships  (ALL NEW)

```
users ──1:N─→ spaces ──1:N─→ pages ──self-FK(parent_id)─→ pages   (tree)
projects ──0/1:N─→ spaces        (spaces.project_id nullable FK)
pages ──1:N─→ page_versions
pages ──1:N─→ page_comments
users ──1:N─→ page_versions, page_comments  (authorship)
```

### Space  (`spaces`) — a container of pages, user-owned
| Field        | Type          | Notes |
|--------------|---------------|-------|
| id           | uuid          | PK, `gen_random_uuid()` |
| user_id      | uuid          | FK `users(id)` ON DELETE CASCADE, NOT NULL |
| project_id   | uuid?         | FK `projects(id)` ON DELETE SET NULL, nullable (`NULL` = personal/unscoped space) |
| name         | text          | NOT NULL, 1–200 chars |
| icon         | text?         | emoji glyph (e.g. `"📘"`), nullable |
| description  | text?         | nullable |
| created_at   | timestamptz   | `now()` |
| updated_at   | timestamptz   | `now()` |

### Page  (`pages`) — a document inside a Space, arranged as a TREE
| Field        | Type          | Notes |
|--------------|---------------|-------|
| id           | uuid          | PK |
| space_id     | uuid          | FK `spaces(id)` ON DELETE CASCADE, NOT NULL |
| parent_id    | uuid?         | self-FK `pages(id)` ON DELETE CASCADE, nullable (`NULL` = top-level page in the space) |
| user_id      | uuid          | FK `users(id)` ON DELETE CASCADE, NOT NULL (author/owner) |
| title        | text          | NOT NULL DEFAULT `'Untitled'` |
| kind         | text          | CHECK in (`'page'`,`'whiteboard'`), DEFAULT `'page'` |
| content      | jsonb         | TipTap/ProseMirror JSON doc for `kind='page'`; DEFAULT `'{}'::jsonb` |
| excalidraw   | jsonb?        | Excalidraw scene for `kind='whiteboard'`; nullable |
| status       | text          | CHECK in (`'draft'`,`'published'`), DEFAULT `'draft'` |
| position     | int           | NOT NULL DEFAULT 0; order among siblings (same space_id+parent_id) |
| created_at   | timestamptz   | `now()` |
| updated_at   | timestamptz   | `now()` (bumped on every update) |
| published_at | timestamptz?  | nullable; set when first/most-recently published |

Tree rules: a page's siblings share `(space_id, parent_id)`; ordering by
`position` then `created_at`. Reparenting must keep `space_id` constant (a page
cannot move between spaces). Cycle prevention is enforced in the `move` service
(a page may not be reparented under itself or any descendant).

### PageVersion  (`page_versions`) — immutable snapshot history
| Field      | Type        | Notes |
|------------|-------------|-------|
| id         | uuid        | PK |
| page_id    | uuid        | FK `pages(id)` ON DELETE CASCADE, NOT NULL |
| user_id    | uuid        | FK `users(id)` ON DELETE CASCADE, NOT NULL (who created the snapshot) |
| title      | text        | NOT NULL (title at snapshot time) |
| content    | jsonb       | NOT NULL (content at snapshot time) |
| created_at | timestamptz | `now()` |

Snapshot taken automatically on **publish**, and on **explicit save-version**.

### PageComment  (`page_comments`) — flat page-level comments
| Field      | Type        | Notes |
|------------|-------------|-------|
| id         | uuid        | PK |
| page_id    | uuid        | FK `pages(id)` ON DELETE CASCADE, NOT NULL |
| user_id    | uuid        | FK `users(id)` ON DELETE CASCADE, NOT NULL (author) |
| body       | text        | NOT NULL, 1–10000 chars |
| created_at | timestamptz | `now()` |

### Attachments / images
No new table. Images embedded in the editor upload via the dedicated page-image
endpoint (Section C / D) which writes to `backend/uploads/` and returns
`{ "url": "/uploads/<file>" }`. The URL is stored inline inside the TipTap JSON
`image` node's `src` attribute. No DB row tracks page images.

---

## B. DDL — `backend/migrations/0007_docs.sql`

Owned by foundation. Idempotent (`IF NOT EXISTS`). Requires `pgcrypto`
(`gen_random_uuid`) and `pg_trgm` (already used elsewhere for search GIN).

```sql
-- =============================================================================
-- Migration: 0007_docs.sql
-- Confluence-style Docs: spaces, pages (tree), page_versions, page_comments.
-- Additive. status/kind stored as text+CHECK (enum-as-text convention).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── spaces ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spaces (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    project_id  uuid                 REFERENCES projects(id) ON DELETE SET NULL,
    name        text        NOT NULL,
    icon        text,
    description text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spaces_user        ON spaces (user_id);
CREATE INDEX IF NOT EXISTS idx_spaces_user_project ON spaces (user_id, project_id);

-- ── pages (self-referential tree) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pages (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id     uuid        NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    parent_id    uuid                 REFERENCES pages(id)  ON DELETE CASCADE,
    user_id      uuid        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    title        text        NOT NULL DEFAULT 'Untitled',
    kind         text        NOT NULL DEFAULT 'page'
                     CHECK (kind IN ('page', 'whiteboard')),
    content      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    excalidraw   jsonb,
    status       text        NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'published')),
    position     int         NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_pages_space          ON pages (space_id);
CREATE INDEX IF NOT EXISTS idx_pages_space_parent_pos
    ON pages (space_id, parent_id, position);
CREATE INDEX IF NOT EXISTS idx_pages_user           ON pages (user_id);
-- Fuzzy title search (pg_trgm GIN), powers GET /api/pages/search?q=
CREATE INDEX IF NOT EXISTS idx_pages_title_trgm
    ON pages USING gin (title gin_trgm_ops);

-- ── page_versions (snapshot history) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS page_versions (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id    uuid        NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      text        NOT NULL,
    content    jsonb       NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_page_versions_page
    ON page_versions (page_id, created_at DESC);

-- ── page_comments (flat) ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS page_comments (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id    uuid        NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_page_comments_page
    ON page_comments (page_id, created_at);
```

---

## C. REST endpoint map

All paths are prefixed with `/api`. All require `Authorization: Bearer <token>`.
JSON unless noted. `:id` etc. are UUIDs. Bodies validated server-side.

### main.rs mounts (foundation owns main.rs + modules/mod.rs)
```rust
// modules/mod.rs adds:
pub mod space;
pub mod page;
pub mod doc_comment;

// main.rs api_router adds:
    .nest("/spaces",   modules::space::router())
    .nest("/pages",    modules::page::router())
    // doc_comment routes are page-scoped → mounted under /pages by page::router,
    // OR nested separately under /pages; doc_comment::router() is nested at
    // "/pages" alongside page::router via .merge — see note below.
```
NOTE on comments mounting: to keep `:id` routing unambiguous and ownership clean,
the `doc_comment` module exposes `pub fn router() -> Router<AppState>` whose routes
are **relative to `/pages`** (`/:id/comments`, `/:id/comments/:comment_id`). It is
mounted with `.nest("/pages", modules::doc_comment::router())` AFTER the page
router merge. Axum allows multiple `.nest` on the same prefix only via `.merge`,
so foundation merges them: `modules::page::router().merge(modules::doc_comment::router())`
and nests the result under `/pages`. Both routers therefore use **relative**
paths with no leading `/pages`.

### Spaces — module `space`, mounted at `/api/spaces`
| Method | Path                 | Body | Query | Response |
|--------|----------------------|------|-------|----------|
| GET    | `/api/spaces`        | —    | `?project_id?` | `200 [Space]` |
| POST   | `/api/spaces`        | `{ name, icon?, description?, project_id? }` | — | `201 Space` |
| GET    | `/api/spaces/:id`    | —    | — | `200 Space` |
| PATCH  | `/api/spaces/:id`    | `{ name?, icon?, description?, project_id? }` | — | `200 Space` |
| DELETE | `/api/spaces/:id`    | —    | — | `204` (cascades pages) |

### Pages — module `page`, mounted at `/api/pages`
Literal segments (`search`, `move`) MUST be registered before `/:id` so they are
not parsed as UUIDs (same rule as board_column `/reorder`).

| Method | Path                          | Body | Query | Response |
|--------|-------------------------------|------|-------|----------|
| GET    | `/api/pages`                  | —    | `?space_id=<uuid>` (required) | `200 PageTreeNode[]` (nested tree, top-level pages with `children`) |
| GET    | `/api/pages/search`           | —    | `?q=<str>&space_id?` | `200 PageSearchResult[]` (pg_trgm title match) |
| GET    | `/api/pages/:id`              | —    | — | `200 Page` (full row incl. content/excalidraw) |
| POST   | `/api/pages`                  | `{ space_id, parent_id?, title?, kind? }` | — | `201 Page` (status `draft`, empty content) |
| PATCH  | `/api/pages/:id`              | `{ title?, content?, kind?, excalidraw?, position?, parent_id? }` | — | `200 Page` (autosave path; bumps `updated_at`) |
| DELETE | `/api/pages/:id`              | —    | — | `204` (cascades children + versions + comments) |
| POST   | `/api/pages/:id/publish`      | — (optional `{}`) | — | `200 Page` (status→`published`, sets `published_at`, snapshots a `page_version`) |
| POST   | `/api/pages/move`             | `{ id, parent_id?, position }` | — | `200 Page` (reparent within same space + reorder siblings; rejects cycles `422`) |
| GET    | `/api/pages/:id/versions`     | —    | — | `200 [PageVersionSummary]` (newest first, no content body) |
| POST   | `/api/pages/:id/versions`     | — (optional `{}`) | — | `201 PageVersionSummary` (explicit save-version snapshot of current content) |
| GET    | `/api/pages/:id/versions/:version_id` | — | — | `200 PageVersion` (full content) |
| POST   | `/api/pages/:id/versions/:version_id/restore` | — | — | `200 Page` (copies version title+content onto the page; snapshots current first) |
| POST   | `/api/pages/:id/images`       | `multipart/form-data` field `file` | — | `201 { url: string }` (generic page image upload; writes to `/uploads`) |

### Comments — module `doc_comment`, paths relative, merged under `/api/pages`
| Method | Path                                  | Body | Query | Response |
|--------|---------------------------------------|------|-------|----------|
| GET    | `/api/pages/:id/comments`             | —    | — | `200 [PageComment]` (oldest first) |
| POST   | `/api/pages/:id/comments`             | `{ body }` | — | `201 PageComment` |
| DELETE | `/api/pages/:id/comments/:comment_id` | —    | — | `204` (author only) |

Standard error responses across all: `400/422` validation, `401` unauthenticated,
`404` not found / not owned, `204` on delete.

---

## D. Editor content model

- `kind='page'` stores a **TipTap (ProseMirror) JSON document** in `pages.content`
  (`{ "type": "doc", "content": [...] }`). The backend treats `content` as opaque
  `jsonb`; no server-side schema validation of the doc beyond "is valid JSON".
- `kind='whiteboard'` stores an **Excalidraw scene** in `pages.excalidraw`
  (`{ elements: [...], appState: {...}, files: {...} }`). `content` stays `{}`.

### TipTap extension set (StarterKit covers core marks/nodes; add the rest)
- `@tiptap/starter-kit` → doc, paragraph, text, **bold, italic, strike**, heading,
  bullet/ordered list, blockquote, **horizontalRule**, hard break, history,
  code (inline). (StarterKit's `codeBlock` is REPLACED by lowlight version below.)
- `@tiptap/extension-underline` → underline
- `@tiptap/extension-text-align` → text align (left/center/right/justify)
- `@tiptap/extension-task-list` + `@tiptap/extension-task-item` → task lists
- `@tiptap/extension-code-block-lowlight` (+ `lowlight`) → syntax-highlighted code block
- `@tiptap/extension-table` + `-table-row` + `-table-header` + `-table-cell` → tables
- `@tiptap/extension-image` → images (`src` = `/uploads/<file>` from upload endpoint)
- `@tiptap/extension-link` → links
- `@tiptap/extension-placeholder` → empty-state placeholder text
- `@tiptap/extension-mention` (+ `tippy.js`) → `@mentions` (suggestion popup)
- `@tiptap/extension-character-count` → optional counter (toolbar status)
- `@tiptap/suggestion` (transitive) → powers slash menu + mention suggestion

### Custom node types (editor agent implements as `Node`/`NodeView`)
| Node name        | TipTap type key   | Purpose / attrs |
|------------------|-------------------|-----------------|
| Info panel       | `infoPanel`       | `attrs: { variant: 'info'|'note'|'warning' }`, block container with child content |
| Two-column layout| `columns`         | wrapper holding 2 `column` children; each `column` is a block container |
| Mermaid diagram  | `mermaid`         | `attrs: { code: string }`; NodeView renders text→diagram via `mermaid` lib |
| Table of contents| `tableOfContents` | attrs: none; NodeView scans heading nodes and renders anchored list |

Slash `/` command menu and the formatting toolbar are editor-agent components that
emit TipTap commands inserting the nodes above. Emoji picker inserts a plain text
emoji glyph (no custom node). Templates (1-on-1 Meeting, 4 Ls Retrospective,
5 Whys Analysis, blank) are static TipTap JSON fragments inserted on page create.

### Images upload flow (DEFINED endpoint — lives in `page` module)
`POST /api/pages/:id/images` (multipart, field `file`) → server reuses the exact
multipart-handling pattern from `work_item::create_attachment` (read first `file`
field, write to `backend/uploads/<uuid-or-sanitized-name>`), but does NOT create a
DB row. Returns `201 { "url": "/uploads/<stored-file>" }`. The editor inserts an
`image` node with `src` = that URL. (We deliberately do NOT reuse the work-item
attachment endpoint — wrong resource scope. This generic page-image endpoint is the
canonical path.)

### Read-only render
The published read-only view (routes agent) renders the same TipTap JSON with the
identical extension set but `editable: false`, so custom node views (panels,
columns, mermaid, TOC) render identically without editing affordances.

---

## E. Frontend contract

### E.1 npm deps to add to `frontend/package.json` (foundation owns)
React-19-compatible versions (TipTap v2 line; mermaid 11; excalidraw 0.17.x).
```jsonc
"dependencies": {
  "@tiptap/react": "^2.11.0",
  "@tiptap/pm": "^2.11.0",
  "@tiptap/starter-kit": "^2.11.0",
  "@tiptap/extension-underline": "^2.11.0",
  "@tiptap/extension-text-align": "^2.11.0",
  "@tiptap/extension-task-list": "^2.11.0",
  "@tiptap/extension-task-item": "^2.11.0",
  "@tiptap/extension-code-block-lowlight": "^2.11.0",
  "@tiptap/extension-table": "^2.11.0",
  "@tiptap/extension-table-row": "^2.11.0",
  "@tiptap/extension-table-header": "^2.11.0",
  "@tiptap/extension-table-cell": "^2.11.0",
  "@tiptap/extension-image": "^2.11.0",
  "@tiptap/extension-link": "^2.11.0",
  "@tiptap/extension-placeholder": "^2.11.0",
  "@tiptap/extension-mention": "^2.11.0",
  "@tiptap/extension-character-count": "^2.11.0",
  "@tiptap/suggestion": "^2.11.0",
  "lowlight": "^3.1.0",
  "tippy.js": "^6.3.7",
  "mermaid": "^11.4.0",
  "@excalidraw/excalidraw": "^0.17.6"
}
```
Notes: `cmdk` (already present) backs the slash menu UI if desired; no separate
emoji-data lib is required (emoji inserted as plain glyphs via a small static list
shipped in the editor feature). `lowlight` ^3 pairs with TipTap v2's
`code-block-lowlight`. `@excalidraw/excalidraw` must be dynamically imported
(`next/dynamic`, `ssr: false`) — whiteboard agent's concern.

### E.2 TypeScript types to add to `frontend/src/types/index.ts` (foundation owns)
```ts
export type PageKind = "page" | "whiteboard";
export type PageStatus = "draft" | "published";

export interface Space {
  id: string;
  user_id: string;
  project_id: string | null;
  name: string;
  icon: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// Opaque TipTap/ProseMirror doc + Excalidraw scene
export type TipTapDoc = Record<string, unknown>;
export type ExcalidrawScene = Record<string, unknown>;

export interface Page {
  id: string;
  space_id: string;
  parent_id: string | null;
  user_id: string;
  title: string;
  kind: PageKind;
  content: TipTapDoc;
  excalidraw: ExcalidrawScene | null;
  status: PageStatus;
  position: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

// GET /api/pages?space_id= returns nested tree nodes
export interface PageTreeNode {
  id: string;
  space_id: string;
  parent_id: string | null;
  title: string;
  kind: PageKind;
  status: PageStatus;
  position: number;
  children: PageTreeNode[];
}

export interface PageSearchResult {
  id: string;
  space_id: string;
  title: string;
  kind: PageKind;
}

export interface PageVersionSummary {
  id: string;
  page_id: string;
  user_id: string;
  title: string;
  created_at: string;
}

export interface PageVersion extends PageVersionSummary {
  content: TipTapDoc;
}

export interface PageComment {
  id: string;
  page_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export interface PageImageUploadResponse {
  url: string; // "/uploads/<file>"
}
```

### E.3 API_ENDPOINTS keys to add (foundation owns)
```ts
  // ── Docs: Spaces (/api/spaces) ────────────────────────────────────────────
  SPACES: "/api/spaces",                                  // GET ?project_id? / POST
  SPACE_BY_ID: (id: string) => `/api/spaces/${id}`,       // GET / PATCH / DELETE

  // ── Docs: Pages (/api/pages) ──────────────────────────────────────────────
  PAGES: "/api/pages",                                    // GET ?space_id= / POST
  PAGE_BY_ID: (id: string) => `/api/pages/${id}`,         // GET / PATCH / DELETE
  PAGES_SEARCH: "/api/pages/search",                      // GET ?q=&space_id?
  PAGE_MOVE: "/api/pages/move",                           // POST { id, parent_id?, position }
  PAGE_PUBLISH: (id: string) => `/api/pages/${id}/publish`,
  PAGE_VERSIONS: (id: string) => `/api/pages/${id}/versions`,            // GET / POST
  PAGE_VERSION_BY_ID: (id: string, vid: string) =>
    `/api/pages/${id}/versions/${vid}`,                                  // GET
  PAGE_VERSION_RESTORE: (id: string, vid: string) =>
    `/api/pages/${id}/versions/${vid}/restore`,                          // POST
  PAGE_IMAGES: (id: string) => `/api/pages/${id}/images`,                // POST multipart
  PAGE_COMMENTS: (id: string) => `/api/pages/${id}/comments`,            // GET / POST
  PAGE_COMMENT_BY_ID: (id: string, cid: string) =>
    `/api/pages/${id}/comments/${cid}`,                                  // DELETE
```

### E.4 Sidebar nav entry (foundation owns `components/layout/sidebar.tsx`)
Add to `NAV_ITEMS` (suggested position after "Hierarchy", before "Goals"):
```ts
{ label: "Docs", href: "/docs", icon: FileText },
```
(import `FileText` from `lucide-react`). Active state via existing
`pathname.startsWith(item.href)`.

### E.5 Routes (routes agent owns `app/docs/*`)
| Route file | Path | Renders |
|------------|------|---------|
| `app/docs/page.tsx` | `/docs` | Spaces index (grid/list of spaces) |
| `app/docs/[spaceId]/page.tsx` | `/docs/:spaceId` | Space view (page tree sidebar + page list) |
| `app/docs/[spaceId]/[pageId]/page.tsx` | `/docs/:spaceId/:pageId` | Page editor (DocEditor for `page`, Whiteboard for `whiteboard`) |
| `app/docs/[spaceId]/[pageId]/published/page.tsx` | `/docs/:spaceId/:pageId/published` | Read-only published render (TipTap `editable:false`) |

### E.6 File-ownership split (binding; do NOT edit outside your area)

BACKEND — new modules under `backend/src/modules/`:
- `space/`        (foundation creates skeleton ownership; module agent fills CRUD)
- `page/`         (pages tree, get/create/update/delete, publish, move, versions, search, `:id/images`)
- `doc_comment/`  (page comments; relative routes merged under `/pages`)
- Each: `pub fn router() -> axum::Router<AppState>`.
- Foundation owns: `modules/mod.rs` (declare the three), `main.rs` (mount), and
  `migrations/0007_docs.sql`.

FRONTEND — under `frontend/src`:
- **foundation** owns: `package.json` (deps in E.1), `types/index.ts` (E.2 + E.3),
  `components/layout/sidebar.tsx` (E.4 nav entry), and the docs skeleton dir
  `features/docs/` — specifically `features/docs/useDocs.ts` (ALL data hooks:
  `useSpaces`, `useSpace`, `useCreateSpace`, `useUpdateSpace`, `useDeleteSpace`,
  `usePageTree`, `usePage`, `useCreatePage`, `useUpdatePage`, `useDeletePage`,
  `usePublishPage`, `useMovePage`, `usePageVersions`, `usePageVersion`,
  `useRestoreVersion`, `useSaveVersion`, `usePageComments`, `useCreateComment`,
  `useDeleteComment`, `useSearchPages`, `useUploadPageImage`), `features/docs/types.ts`
  (shared local types re-exporting from `@/types`), and an
  `features/docs/extensions.md` note (empty extensions registry placeholder).
- **editor** owns: `features/docs/editor/*` — `DocEditor.tsx`, all TipTap extensions,
  toolbar, slash menu, templates, node views (infoPanel / columns / mermaid /
  tableOfContents). Self-contained; imports hooks/types from `features/docs` + `@/types`.
- **shell** owns: `features/docs/spaces/*` (space list + space view) and
  `features/docs/pages/*` (page tree sidebar + page list table).
- **routes** owns: `app/docs/*` (E.5).
- **collab** owns: `features/docs/collab/*` (version history panel + comments panel
  components, using foundation's hooks).
- **whiteboard** owns: `features/docs/whiteboard/*` (Excalidraw wrapper for
  `kind='whiteboard'`, dynamic import, persists via `useUpdatePage`).

Import discipline: all features import data hooks + types from `@/features/docs`
(foundation) and shared types from `@/types`. No agent edits files outside its
listed paths.
