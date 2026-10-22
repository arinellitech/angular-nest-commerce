#!/bin/sh
set -e

# Apply pending migrations (compiled migrate script; idempotent).
node dist/database/migrate.js

exec node dist/main.js
