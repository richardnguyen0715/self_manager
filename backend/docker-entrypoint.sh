#!/bin/sh
set -e

echo "Running database migrations..."
# sqlx migrate run requires DATABASE_URL in environment
# The binary is expected to expose a migrate subcommand, or we use sqlx-cli
# If sqlx-cli is not available at runtime, migrations should be embedded via
# sqlx::migrate!() called at application startup. This script handles the
# explicit CLI path; remove if migrations run inside main().
if command -v sqlx > /dev/null 2>&1; then
    sqlx migrate run --database-url "${DATABASE_URL}"
else
    echo "sqlx CLI not found – migrations will run via application startup code."
fi

echo "Starting application..."
exec "$@"
