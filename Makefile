# ──────────────────────────────────────────────────────────────────────────────
# manage-my-life – top-level Makefile
# ──────────────────────────────────────────────────────────────────────────────
# Usage:
#   make up        – build images and start all services
#   make down      – stop and remove containers (keeps volumes)
#   make logs      – tail logs for all services (Ctrl-C to stop)
#   make migrate   – run pending database migrations inside the backend container
#   make fmt       – format Rust + TypeScript source
#   make dev       – start only infra services (postgres, redis) for local dev

COMPOSE        := docker compose
COMPOSE_FILE   := docker-compose.yml
BACKEND_SVC    := backend
FRONTEND_SVC   := frontend

# Colour helpers (no-op if the terminal doesn't support them)
BOLD  := $(shell tput bold 2>/dev/null || true)
RESET := $(shell tput sgr0 2>/dev/null || true)

.PHONY: help up down restart logs ps migrate fmt dev \
        build-backend build-frontend shell-backend shell-db

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "$(BOLD)%-18s$(RESET) %s\n", $$1, $$2}'

# ── Lifecycle ─────────────────────────────────────────────────────────────────

up: ## Build images (if changed) and start all services in the background
	@echo "$(BOLD)Starting all services...$(RESET)"
	$(COMPOSE) -f $(COMPOSE_FILE) up --build -d
	@echo "$(BOLD)Services ready:$(RESET)"
	@echo "  Frontend   -> http://localhost"
	@echo "  API        -> http://localhost/api"
	@echo "  WebSocket  -> ws://localhost/ws"
	@echo "  Grafana    -> http://localhost:3001"
	@echo "  Prometheus -> http://localhost:9090"

down: ## Stop and remove containers (volumes are preserved)
	@echo "$(BOLD)Stopping all services...$(RESET)"
	$(COMPOSE) -f $(COMPOSE_FILE) down

down-v: ## Stop and remove containers AND volumes (destructive – wipes DB data)
	@echo "$(BOLD)Stopping all services and removing volumes...$(RESET)"
	$(COMPOSE) -f $(COMPOSE_FILE) down -v

restart: ## Restart all services
	$(COMPOSE) -f $(COMPOSE_FILE) restart

ps: ## Show running containers and their status
	$(COMPOSE) -f $(COMPOSE_FILE) ps

# ── Logs ──────────────────────────────────────────────────────────────────────

logs: ## Tail logs for all services (Ctrl-C to stop)
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f

logs-backend: ## Tail backend logs only
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f $(BACKEND_SVC)

logs-frontend: ## Tail frontend logs only
	$(COMPOSE) -f $(COMPOSE_FILE) logs -f $(FRONTEND_SVC)

# ── Database ──────────────────────────────────────────────────────────────────

migrate: ## Run pending SQLx migrations against the running postgres container
	@echo "$(BOLD)Running migrations...$(RESET)"
	$(COMPOSE) -f $(COMPOSE_FILE) exec $(BACKEND_SVC) \
	  sqlx migrate run --database-url "$$DATABASE_URL" || \
	  echo "Note: sqlx CLI not installed in container. Migrations run at app startup."

migrate-create: ## Create a new migration file (NAME= required, e.g. make migrate-create NAME=add_users)
	@if [ -z "$(NAME)" ]; then echo "Usage: make migrate-create NAME=<migration_name>"; exit 1; fi
	cd backend && sqlx migrate add $(NAME)

# ── Formatting ────────────────────────────────────────────────────────────────

fmt: ## Format Rust (cargo fmt) and TypeScript (prettier) source code
	@echo "$(BOLD)Formatting Rust...$(RESET)"
	cd backend && cargo fmt --all
	@echo "$(BOLD)Formatting TypeScript/CSS...$(RESET)"
	cd frontend && npx prettier --write "src/**/*.{ts,tsx,css,json}" 2>/dev/null || \
	  echo "prettier not available locally; run inside the container."
	@echo "$(BOLD)Format complete.$(RESET)"

lint: ## Run cargo clippy and eslint
	@echo "$(BOLD)Linting Rust...$(RESET)"
	cd backend && cargo clippy --all-targets --all-features -- -D warnings
	@echo "$(BOLD)Linting TypeScript...$(RESET)"
	cd frontend && npx eslint "src/**/*.{ts,tsx}" 2>/dev/null || true

# ── Local development (infra only) ───────────────────────────────────────────

dev: ## Start only postgres + redis for local development (run backend/frontend natively)
	@echo "$(BOLD)Starting local dev infrastructure (postgres + redis)...$(RESET)"
	$(COMPOSE) -f $(COMPOSE_FILE) up -d postgres redis
	@echo "$(BOLD)Ready for local development:$(RESET)"
	@echo "  DATABASE_URL=postgres://mml:<password>@localhost:5432/manage_my_life"
	@echo "  REDIS_URL=redis://:<password>@localhost:6379"
	@echo ""
	@echo "  Backend: cd backend && cargo run"
	@echo "  Frontend: cd frontend && npm run dev"

dev-down: ## Stop local dev infrastructure
	$(COMPOSE) -f $(COMPOSE_FILE) stop postgres redis

# ── Build helpers ────────────────────────────────────────────────────────────

build-backend: ## Build only the backend image
	$(COMPOSE) -f $(COMPOSE_FILE) build $(BACKEND_SVC)

build-frontend: ## Build only the frontend image
	$(COMPOSE) -f $(COMPOSE_FILE) build $(FRONTEND_SVC)

# ── Shell access ─────────────────────────────────────────────────────────────

shell-backend: ## Open a shell inside the running backend container
	$(COMPOSE) -f $(COMPOSE_FILE) exec $(BACKEND_SVC) /bin/sh

shell-db: ## Open a psql session against the running postgres container
	$(COMPOSE) -f $(COMPOSE_FILE) exec postgres \
	  psql -U $${POSTGRES_USER:-mml} -d $${POSTGRES_DB:-manage_my_life}

shell-redis: ## Open a redis-cli session
	$(COMPOSE) -f $(COMPOSE_FILE) exec redis \
	  redis-cli -a $${REDIS_PASSWORD}

# ── Utilities ────────────────────────────────────────────────────────────────

env-check: ## Verify required .env variables are set
	@test -f .env || (echo "ERROR: .env file not found. Copy .env.example first."; exit 1)
	@echo "$(BOLD)Checking required env vars...$(RESET)"
	@for var in POSTGRES_PASSWORD REDIS_PASSWORD JWT_SECRET; do \
	  grep -q "^$$var=" .env || (echo "ERROR: $$var is not set in .env"; exit 1); \
	  val=$$(grep "^$$var=" .env | cut -d= -f2); \
	  [ "$$val" = "CHANGE_ME_strong_password" ] || [ "$$val" = "CHANGE_ME_at_least_64_chars_random_secret_here_use_openssl_rand" ] && \
	    echo "WARNING: $$var still has a placeholder value — change it before deploying." || true; \
	done
	@echo "$(BOLD)Env check passed.$(RESET)"

gen-secrets: ## Generate strong random values for JWT_SECRET and passwords
	@echo "$(BOLD)Generated secrets (paste into .env):$(RESET)"
	@printf "POSTGRES_PASSWORD=%s\n" "$$(openssl rand -base64 32)"
	@printf "REDIS_PASSWORD=%s\n"    "$$(openssl rand -base64 24)"
	@printf "JWT_SECRET=%s\n"        "$$(openssl rand -hex 64)"
	@printf "GRAFANA_ADMIN_PASSWORD=%s\n" "$$(openssl rand -base64 16)"

# ──────────────────────────────────────────────────────────────────────────────
# Production deployment (Caddy auto-TLS) — docker/docker-compose.prod.yml
# On the server:  make prod-env  → edit .env  → make prod-up
# ──────────────────────────────────────────────────────────────────────────────
PROD_COMPOSE := docker compose --env-file .env -f docker/docker-compose.prod.yml

.PHONY: prod-env prod-up prod-down prod-restart prod-rebuild prod-logs prod-ps prod-psql

prod-env: ## Create .env from .env.prod.example if missing (then edit secrets)
	@test -f .env || (cp .env.prod.example .env && echo "created .env — edit DOMAIN/secrets, then 'make prod-up'")

prod-up: ## Build + start the full production stack (postgres, redis, backend, frontend, caddy)
	@test -f .env || { echo "ERROR: .env missing. Run 'make prod-env' first."; exit 1; }
	$(PROD_COMPOSE) up -d --build
	@echo "$(BOLD)Deployed.$(RESET) Caddy is provisioning TLS for $$(grep ^DOMAIN= .env | cut -d= -f2). Watch: make prod-logs"

prod-down: ## Stop the production stack (volumes preserved)
	$(PROD_COMPOSE) down

prod-restart: ## Restart the production stack
	$(PROD_COMPOSE) restart

prod-rebuild: ## Rebuild images from current code and restart (no data loss)
	$(PROD_COMPOSE) up -d --build

prod-logs: ## Tail production logs (all services)
	$(PROD_COMPOSE) logs -f

prod-ps: ## Show production container status
	$(PROD_COMPOSE) ps

prod-psql: ## psql into the production database
	$(PROD_COMPOSE) exec postgres psql -U $${POSTGRES_USER:-mml} -d $${POSTGRES_DB:-manage_my_life}

# ── Server mode: Cloudflare Tunnel + host nginx (no built-in proxy) ──────────
# docker/docker-compose.server.yml binds frontend/backend to 127.0.0.1 ports.
SERVER_COMPOSE := docker compose --env-file .env -f docker/docker-compose.server.yml

.PHONY: server-up server-down server-rebuild server-logs server-ps

server-up: ## Build + start the loopback stack (for Cloudflare/nginx-fronted servers)
	@test -f .env || { echo "ERROR: .env missing. Run 'make prod-env' first."; exit 1; }
	$(SERVER_COMPOSE) up -d --build
	@echo "$(BOLD)Up.$(RESET) frontend->127.0.0.1:$${WEB_PORT:-3100}  backend->127.0.0.1:$${API_PORT:-3101}"
	@echo "  Install nginx vhost + cloudflared ingress for $$(grep ^DOMAIN= .env | cut -d= -f2), then reload."

server-down: ## Stop the loopback stack (volumes preserved)
	$(SERVER_COMPOSE) down

server-rebuild: ## Rebuild images from current code and restart (no data loss)
	$(SERVER_COMPOSE) up -d --build

server-logs: ## Tail loopback stack logs
	$(SERVER_COMPOSE) logs -f

server-ps: ## Show loopback stack container status
	$(SERVER_COMPOSE) ps
