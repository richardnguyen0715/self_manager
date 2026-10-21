# Deploying manage-my-life → app.example.com

Self-hosted, single-server stack. Caddy terminates TLS (auto Let's Encrypt) and
reverse-proxies to the Rust backend and Next.js frontend.

```
            ┌──────────────────────────── server ────────────────────────────┐
 Internet ──┤ Caddy :80/:443 ── /api,/ws,/uploads → backend:8080 (Rust/Axum)  │
 (TLS)      │                ── /*               → frontend:3000 (Next.js)    │
            │ postgres:16   redis:7                                           │
            └─────────────────────────────────────────────────────────────────┘
```

## 0. Prerequisites (one-time, on the server)

- Docker + Docker Compose plugin installed.
- Ports **80** and **443** open to the internet (TCP, and 443/UDP for HTTP/3).
- DNS: an **A record** `app.example.com → <server public IP>` (AAAA if IPv6).
  Caddy cannot get a certificate until this resolves to the server.

## 1. Clone

```bash
ssh user@your-server
cd Coding
git clone https://github.com/richardnguyen0715/self_manager.git
cd manage-my-life
```

## 2. Configure

```bash
make prod-env            # copies .env.prod.example → .env
make gen-secrets         # prints strong POSTGRES_PASSWORD / JWT_SECRET
nano .env                # set DOMAIN, TLS_EMAIL, POSTGRES_PASSWORD, JWT_SECRET
```

Required in `.env`: `DOMAIN=app.example.com`, `TLS_EMAIL`, `POSTGRES_PASSWORD`,
`JWT_SECRET` (64-byte hex).

## 3. Launch

```bash
make prod-up             # build images + start the stack
make prod-logs           # watch Caddy obtain the certificate
```

First boot: the backend runs DB migrations automatically (`sqlx::migrate!`).
Caddy provisions the TLS cert within ~30s once DNS resolves. Open
**https://app.example.com**, register a user, done.

## 4. Updating (redeploy new code)

```bash
cd ~/Coding/manage-my-life
git pull
make prod-rebuild        # rebuilds changed images, restarts; volumes (DB) intact
```

## Operations

| Command | What |
|---|---|
| `make prod-ps`      | container status |
| `make prod-logs`    | tail all logs |
| `make prod-restart` | restart services |
| `make prod-down`    | stop (DB/uploads volumes preserved) |
| `make prod-psql`    | psql into the database |

Data lives in named volumes: `pg_data` (database), `uploads` (avatars +
attachments), `caddy_data` (certs). `make prod-down` keeps them; only
`docker compose ... down -v` destroys data.

## Notes

- `NEXT_PUBLIC_API_URL=https://${DOMAIN}` is baked into the frontend at build
  time, so the site calls its own origin and Caddy routes `/api` + `/ws` to the
  backend. Changing the domain requires a frontend rebuild (`make prod-rebuild`).
- The backend image is built with `SQLX_OFFLINE=true` using the committed
  `backend/.sqlx` query cache — no database is needed at build time.
- No secrets are committed; `.env` is git-ignored.
