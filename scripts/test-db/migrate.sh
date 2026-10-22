#!/usr/bin/env bash
# Applies the bootstrap, every migration in order and the seed to the
# database named by DATABASE_URL. Intended for a LOCAL Postgres only —
# never point it at the shared NGG project.
#
#   DATABASE_URL=postgres://postgres@127.0.0.1:54329/auction_test scripts/test-db/migrate.sh
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL to a local Postgres database}"
cd "$(dirname "$0")/../.."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f scripts/test-db/bootstrap.sql
for f in supabase/migrations/*.sql; do
  echo "applying $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -1 -f "$f"
done
echo "applying supabase/seed.sql"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -1 -f supabase/seed.sql
echo "done"
