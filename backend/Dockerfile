# ──────────────────────────────────────────────────────────────
# Stage 1: chef – compute recipe (dependency cache layer)
# ──────────────────────────────────────────────────────────────
FROM rust:1.83-slim-bookworm AS chef
RUN cargo install cargo-chef --locked
WORKDIR /app

# ──────────────────────────────────────────────────────────────
# Stage 2: planner – generate recipe.json
# ──────────────────────────────────────────────────────────────
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# ──────────────────────────────────────────────────────────────
# Stage 3: builder – compile dependencies then the app
# ──────────────────────────────────────────────────────────────
FROM chef AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# SQLx offline mode: compile-time query checking without a live DB
ARG SQLX_OFFLINE=true
ENV SQLX_OFFLINE=${SQLX_OFFLINE}

WORKDIR /app

# Cache dependencies
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

# Build the application
COPY . .
RUN cargo build --release --bin server

# ──────────────────────────────────────────────────────────────
# Stage 4: runtime – minimal Debian slim image
# ──────────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --shell /bin/sh --create-home appuser

WORKDIR /app

# Copy the compiled binary
COPY --from=builder /app/target/release/server /app/server

# Copy migrations so the entrypoint can run them at startup
COPY --from=builder /app/migrations /app/migrations

# Copy entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Writable uploads dir (avatars + work-item attachments) — owned by appuser so
# a mounted named volume is writable at runtime.
RUN mkdir -p /app/uploads

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["/app/server"]
