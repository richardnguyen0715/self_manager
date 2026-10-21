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
