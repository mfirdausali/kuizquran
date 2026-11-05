#!/usr/bin/env bash
# Boots a DISPOSABLE v3/api instance for the Playwright two-device e2e suite
# (apps/web/playwright.config.ts's second `webServer` entry). This is commit
# 1 of the two-device determinism e2e DECISIONS.md v3-D366/D367/D369/D371
# through D377 each named and deferred: CORS + a second webServer, verified by
# a trivial smoke request, landing BEFORE the real two-device scenario.
#
# A FRESH sqlite file, migrated from scratch on every invocation — the e2e
# suite never reads or writes the real dev database this directory's own
# .env already points at. `make setup` must already have run once (APP_KEY,
# vendor/, the real .env) — this script only overrides DB_* and
# CORS_ALLOWED_ORIGINS for the one process it starts.
set -euo pipefail
cd "$(dirname "$0")/.."

export DB_CONNECTION=sqlite
export DB_DATABASE="$(pwd)/database/e2e.sqlite"
# The e2e Next.js server's own origin — set by playwright.config.ts. Falls
# back to its documented default port so running this script by hand still
# does something sane.
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-http://127.0.0.1:3311}"

: > "$DB_DATABASE"
php artisan migrate:fresh --force

exec php artisan serve --host=127.0.0.1 --port="${E2E_API_PORT:-8011}"
