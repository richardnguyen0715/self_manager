# Contributing

1. Fork and create a branch from `main`.
2. Copy `.env.example` to `.env` and follow the README to run the stack.
3. Backend: `cd backend && cargo fmt && cargo clippy && cargo test`.
   After changing SQL queries, refresh the offline cache with `cargo sqlx prepare`.
4. Frontend: `cd frontend && npm run lint && npx tsc --noEmit`.
5. Open a pull request describing the change. By contributing you agree your
   work is licensed under the MIT License.
