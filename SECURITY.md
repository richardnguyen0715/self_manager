# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's
private vulnerability reporting ("Security" tab → "Report a vulnerability")
and include steps to reproduce. We aim to acknowledge reports within 7 days.

## Deployment notes

- Generate a unique `JWT_SECRET` (`openssl rand -hex 64`) and strong database
  and Redis passwords; never reuse the values from `.env.example`.
- Set `CORS_ORIGINS` to your own domain in production.
- Never commit `.env` files.

## Known limitations

This is a personal project that has not had an independent security audit.
Before exposing an instance to the internet, be aware of:

- **Uploads** (`/uploads`) are served without authentication and without
  `Content-Disposition` / `nosniff` headers, and file types are not restricted.
  Serve them from a separate origin or put an authenticated proxy in front.
- **Docs embeds, Mermaid diagrams and work item descriptions** render
  user-authored content that is not fully sanitized. Treat every account on the
  instance as trusted, and do not publish pages from untrusted authors.
- **Registration is open** and auth endpoints are not rate limited; restrict
  access at the reverse proxy if the instance is not meant to be public.
- JWTs are kept in `localStorage`, and logout / password change do not revoke
  already-issued access tokens (15 minute lifetime).

The bundled Docker Compose stack publishes all service ports on `127.0.0.1`
only. Put a TLS-terminating reverse proxy in front of it (see `docker/DEPLOY.md`).
