# Manage My Life

A full-stack personal productivity application built as a modular monolith. The backend is a single Rust binary (Axum + SQLx + PostgreSQL + Redis) with an Agile OS domain layered on top of the legacy task/project core. The frontend is a Next.js 14 App Router SPA with feature-sliced architecture.

**Agile OS domain** (migration 0003): Goals -> Initiatives -> Epics -> Work Items -> Subtasks, Sprint planning with capacity enforcement, velocity tracking, burndown charts, sprint reviews and retrospectives. Work items supersede legacy tasks as the primary work entity; legacy `/api/tasks` endpoints remain mounted for back-compat.

---

## Architecture

```
manage-my-life/
├── backend/                  Rust modular monolith (single crate)
│   ├── src/
│   │   ├── main.rs           Startup, router assembly, CORS, tracing
│   │   ├── shared/           Cross-cutting concerns
│   │   │   ├── config.rs     Environment variable loading
│   │   │   ├── state.rs      AppState (PgPool + Redis + Config + broadcast)
│   │   │   ├── error.rs      AppError -> IntoResponse (JSON error envelope)
│   │   │   ├── extractors.rs AuthUser extractor (JWT bearer)
│   │   │   ├── jwt.rs        HS512 access + refresh token encoding/decoding
│   │   │   ├── events.rs     DomainEvent enum (broadcast channel)
│   │   │   ├── db.rs         PgPool factory
│   │   │   └── redis.rs      ConnectionManager factory
│   │   └── modules/
│   │       ├── auth/         Registration, login, JWT refresh, /me
│   │       ├── task/         Task CRUD, subtasks, tags
│   │       ├── project/      Project CRUD, reorder, progress
│   │       ├── goal/         Goal CRUD, goal->project hierarchy
│   │       ├── habit/        Habit CRUD, logging, streaks
│   │       ├── calendar/     Calendar events, range queries
│   │       ├── timeblock/    Time blocks, focus session lifecycle
│   │       ├── analytics/    Daily stats, completion rate, time usage
│   │       ├── notification/ In-app notifications, unread count
│   │       ├── search/       Cross-entity full-text search
│   │       ├── dashboard/    Aggregated today view
│   │       └── realtime/     WebSocket push (domain event fan-out)
│   └── migrations/           SQLx migration files (run at startup)
├── frontend/                 Next.js 14 App Router
│   └── src/
│       ├── app/              Route pages (one per feature)
│       ├── features/         Feature-sliced: hooks, components, stores
│       ├── components/       Shared UI (shadcn/ui) + layout (Sidebar, Header)
│       ├── stores/           Zustand stores (auth, ui)
│       └── lib/              API client, utilities
├── infra/
│   ├── nginx/                Reverse proxy config
│   ├── prometheus/           Metrics scrape config
│   └── grafana/              Dashboard provisioning
├── docker-compose.yml        Full stack: postgres, redis, backend, frontend, nginx, prometheus, grafana
└── Makefile                  Developer convenience targets
```

### Router contract

Every module exposes `pub fn router() -> axum::Router<AppState>`. `main.rs` mounts them:

| Mount path           | Module         | Notes              |
|----------------------|----------------|--------------------|
| `/api/auth`          | `auth`         |                    |
| `/api/tasks`         | `task`         | legacy             |
| `/api/projects`      | `project`      | legacy             |
| `/api/goals`         | `goal`         |                    |
| `/api/habits`        | `habit`        |                    |
| `/api/calendar`      | `calendar`     |                    |
| `/api/timeblocks`    | `timeblock`    |                    |
| `/api/analytics`     | `analytics`    | + velocity/burndown/time-by-epic |
| `/api/notifications` | `notification` |                    |
| `/api/search`        | `search`       |                    |
| `/api/dashboard`     | `dashboard`    | + `/sprint` endpoint |
| `/api/initiatives`   | `initiative`   | NEW                |
| `/api/epics`         | `epic`         | NEW                |
| `/api/sprints`       | `sprint`       | NEW                |
| `/api/work-items`    | `work_item`    | NEW                |
| `/api/backlog`       | `backlog`      | NEW                |
| `/ws`                | `realtime`     |                    |

### Domain events

`AppState.events` is a `tokio::sync::broadcast::Sender<DomainEvent>`. Modules publish events and background listeners in `analytics` and `notification` consume them without direct coupling.

Legacy events: `TaskCompleted`, `HabitCompleted`, `TimeBlockFinished`, `ProjectCompleted`, `CalendarEventReminder`, `GoalCompleted`.

Agile OS events: `WorkItemCompleted` (emitted on status->done), `SprintStarted` (on activate), `SprintCompleted` (on complete with velocity).

---

## Tech Stack

**Backend**

| Concern           | Library                                           |
|-------------------|---------------------------------------------------|
| HTTP framework    | Axum 0.7                                          |
| Database          | SQLx 0.7 + PostgreSQL 15                          |
| Cache / sessions  | Redis 7 (redis crate, ConnectionManager)          |
| Auth              | JWT (jsonwebtoken, HS512) + Argon2id              |
| Async runtime     | Tokio 1 (full)                                    |
| Error handling    | thiserror + anyhow                                |
| Validation        | validator 0.18                                    |
| Observability     | tracing + tracing-subscriber                      |
| Background jobs   | apalis 0.6                                        |
| Serialization     | serde + serde_json                                |

**Frontend**

| Concern           | Library                        |
|-------------------|-------------------------------|
| Framework         | Next.js 14 (App Router)        |
| Language          | TypeScript                     |
| Styling           | Tailwind CSS + shadcn/ui       |
| State             | Zustand                        |
| Data fetching     | TanStack Query                 |
| Charts            | Recharts                       |
| Icons             | Lucide React                   |
| Forms             | React Hook Form + Zod          |

**Infrastructure**

| Service     | Purpose                                   |
|-------------|-------------------------------------------|
| PostgreSQL  | Primary data store                        |
| Redis       | Session tokens, caching, job queues       |
| Nginx       | Reverse proxy (port 80 -> frontend + API) |
| Prometheus  | Metrics collection (port 9090)            |
| Grafana     | Dashboards (port 3001)                    |

---

## How to Run

### Prerequisites

- Docker and Docker Compose v2
- For local dev only: Rust 1.78+, Node.js 20+, cargo-sqlx

### Full stack with Docker Compose

1. Copy the example environment file and fill in required secrets:

```bash
cp .env.example .env
# Edit .env -- set POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET
# Or generate them automatically:
make gen-secrets
```

2. Start all services:

```bash
make up
# or directly:
docker compose up --build -d
```

3. Services will be available at:

| URL                          | Service              |
|------------------------------|----------------------|
| `http://localhost`           | Frontend (via nginx) |
| `http://localhost/api`       | REST API             |
| `ws://localhost/ws`          | WebSocket            |
| `http://localhost:3001`      | Grafana              |
| `http://localhost:9090`      | Prometheus           |

Migrations run automatically at backend startup via `sqlx::migrate!`.

### Local development (native)

Start only the infrastructure services:

```bash
make dev
# Starts postgres (5432) and redis (6379) via Docker
```

Backend:

```bash
cd backend
cp .env.example .env  # set DATABASE_URL, REDIS_URL, JWT_SECRET
cargo run
# Server listens on http://localhost:8080
```

Frontend:

```bash
cd frontend
npm install
cp .env.example .env.local  # set NEXT_PUBLIC_API_URL=http://localhost:8080/api
npm run dev
# App on http://localhost:3000
```

---

## Make Targets

| Target                              | Description                                                |
|-------------------------------------|------------------------------------------------------------|
| `make up`                           | Build images and start all services in the background      |
| `make down`                         | Stop containers (volumes preserved)                        |
| `make down-v`                       | Stop containers and delete volumes (wipes database)        |
| `make dev`                          | Start only postgres + redis for local native development   |
| `make logs`                         | Tail all service logs                                      |
| `make logs-backend`                 | Tail backend logs only                                     |
| `make migrate`                      | Run pending migrations against the running postgres        |
| `make migrate-create NAME=add_foo`  | Create a new migration file                                |
| `make fmt`                          | cargo fmt + Prettier                                       |
| `make lint`                         | cargo clippy + ESLint                                      |
| `make shell-backend`                | Shell into the backend container                           |
| `make shell-db`                     | psql session against the running postgres container        |
| `make shell-redis`                  | redis-cli session                                          |
| `make gen-secrets`                  | Generate strong random values for .env secrets             |
| `make env-check`                    | Verify required .env variables are set                     |

---

## API Overview

All authenticated endpoints require `Authorization: Bearer <access_token>`.

Errors are returned as:

```json
{ "error": "NOT_FOUND", "message": "resource not found" }
```

### Auth (`/api/auth`)

| Method | Path       | Auth | Description                        |
|--------|------------|------|------------------------------------|
| POST   | /register  | No   | Create account, returns token pair |
| POST   | /login     | No   | Authenticate, returns token pair   |
| POST   | /refresh   | No   | Rotate refresh token               |
| POST   | /logout    | Yes  | Revoke refresh token               |
| GET    | /me        | Yes  | Return authenticated user profile  |

### Tasks (`/api/tasks`)

CRUD for tasks and subtasks. Tags managed under `/api/tasks/tags`. Task-tag associations via `POST|DELETE /:id/tags/:tag_id`.

### Projects (`/api/projects`)

CRUD + bulk reorder (`PUT /reorder`). Projects link to goals.

### Goals (`/api/goals`)

CRUD + reorder by position + `GET /:id/projects` to list child projects.

### Habits (`/api/habits`)

CRUD + archive (`POST /:id/archive`) + habit logs (`GET|POST /:id/logs`, `DELETE /:id/logs/:log_id`).

### Calendar (`/api/calendar`)

CRUD for calendar events. `GET /` accepts `?start=<rfc3339>&end=<rfc3339>` range query.

### Time Blocks (`/api/timeblocks`)

CRUD + focus session lifecycle under `/:id/focus-sessions`: start (POST), pause/resume/finish (PATCH).

### Analytics (`/api/analytics`)

| Method | Path              | Description                           |
|--------|-------------------|---------------------------------------|
| GET    | /summary          | Period summary (tasks, focus, habits) |
| GET    | /daily            | Daily stats time series               |
| GET    | /time-usage       | Time distribution breakdown           |
| GET    | /completion-rate  | Task completion rate over period      |
| POST   | /refresh          | Recompute today's stats               |
| POST   | /refresh/:date    | Recompute stats for a specific date   |
| GET    | /velocity         | Sprint velocity for last N sprints    |
| GET    | /burndown         | Burndown chart for a sprint           |
| GET    | /time-by-epic     | Focus minutes grouped by epic         |

### Notifications (`/api/notifications`)

List, get, create, update, delete. `POST /:id/read`, `POST /mark-all-read`, `GET /unread-count`.

### Search (`/api/search`)

`GET /api/search?q=<term>&kinds=task,project,habit&limit=20` -- cross-entity ILIKE search.

### Dashboard (`/api/dashboard`)

`GET /` -- full today snapshot (tasks, habits, events, time blocks, quick stats).
`GET /stats` -- quick-stats counters only.
`GET /sprint` -- sprint-centric snapshot (active sprint progress, goal progress, overdue work items, today's time blocks, habits).

### Agile OS (NEW)

**Initiatives** (`/api/initiatives`): CRUD + `GET /:id/epics`. Strategic buckets under a Goal.

**Epics** (`/api/epics`): CRUD + `GET /:id/work-items`. Multi-sprint bodies of work with progress rollup (total/done items, completion rate, story points).

**Sprints** (`/api/sprints`): CRUD + `POST /:id/activate`, `POST /:id/complete`, `GET /active`, `GET /velocity`, `GET /:id/work-items`, `GET /:id/burndown`, `GET|PUT /:id/review`, `GET|PUT /:id/retrospective`. At most one active sprint per user (409 if violated). Capacity enforcement (409 if sprint points exceeded when adding a work item).

**Work Items** (`/api/work-items`): CRUD + status/points/sprint/backlog transitions + subtask management. Backlog = sprint_id IS NULL. Story points ∈ {1,3,5,8,null}.

**Backlog** (`/api/backlog`): `GET /` — filtered list of unassigned work items.

### WebSocket (`/ws`)

Connect with `?token=<access_jwt>`. The server pushes JSON frames for every `DomainEvent` belonging to the authenticated user. Send `{"type":"ping"}` for keepalive; server replies `{"type":"pong"}`.

---

## Frontend Routes

| Route              | Feature                                                |
|--------------------|--------------------------------------------------------|
| `/dashboard`       | Today snapshot + active sprint progress (evolved)      |
| `/backlog`         | NEW — Sprint sections + Backlog; drag items to sprint  |
| `/board`           | NEW — Active sprint Kanban (To do / In progress / Done)|
| `/sprints`         | NEW — Sprint list (planned/active/completed)           |
| `/sprints/[id]`    | NEW — Sprint detail: Overview, Review, Retro, Burndown |
| `/work-items`      | NEW — Filterable work item table                       |
| `/work-items/[id]` | NEW — Work item detail: subtasks, status, details panel|
| `/goals`           | Goal -> Initiative -> Epic hierarchy (evolved)         |
| `/analytics`       | Charts + velocity/burndown/time-by-epic (evolved)      |
| `/tasks`           | Task list (legacy)                                     |
| `/kanban`          | Drag-and-drop Kanban (legacy)                          |
| `/calendar`        | Month/week/day calendar + time grid                    |
| `/timeblocking`    | Time block scheduler with focus timer                  |
| `/habits`          | Habit tracker with streaks and heatmap                 |
| `/focus`           | Focus session (Pomodoro-style)                         |
| `/settings`        | User preferences                                       |
| `/login`           | Login form                                             |
| `/register`        | Registration form                                      |

---

## Development Notes

### SQLx offline mode

The backend uses `sqlx::query!` macros for compile-time SQL verification. Without a running database you must either:

- Set `DATABASE_URL` pointing to a reachable PostgreSQL instance, or
- Run `cargo sqlx prepare` with a live DB to generate the `.sqlx` query cache, then set `SQLX_OFFLINE=true`.

The Docker build (`docker-compose.yml`) passes `SQLX_OFFLINE=true` and expects the `.sqlx` cache to be committed. For local `cargo check` without Docker, start infra first with `make dev` and export `DATABASE_URL`.

### Environment variables

Required:

| Variable            | Description                          |
|---------------------|--------------------------------------|
| `DATABASE_URL`      | PostgreSQL connection string         |
| `REDIS_URL`         | Redis connection string              |
| `JWT_SECRET`        | HS512 signing secret (min 32 bytes)  |
| `POSTGRES_PASSWORD` | Used by docker-compose postgres      |

Optional (sensible defaults apply):

| Variable                 | Default                                         |
|--------------------------|-------------------------------------------------|
| `HOST`                   | `0.0.0.0`                                       |
| `PORT`                   | `8080`                                          |
| `ACCESS_TOKEN_TTL_SECS`  | `900` (15 min)                                  |
| `REFRESH_TOKEN_TTL_SECS` | `2592000` (30 days)                             |
| `CORS_ORIGINS`           | empty = any origin (set to your domain in prod) |
| `RUST_LOG`               | `manage_my_life=info,tower_http=info,sqlx=warn` |

## License

[MIT](LICENSE)
