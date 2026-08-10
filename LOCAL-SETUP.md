# Running this locally

**TL;DR**

```bash
make setup   # once
make dev     # every time  → SPA :5273, API :8000
```

`make doctor` tells you what's missing if something looks wrong.

---

## What you need

| | Version | Check |
|---|---|---|
| Node | 20+ | `node -v` |
| PHP | 8.3+ | `php -v` |
| Composer | 2 | `composer -V` |

SQLite is the default database — nothing to install.

## The two services

This is **two separate npm projects**, which is the single most confusing thing
about the repo:

- `v2/` — the real SPA (Vite, port **5273**)
- `v2/api/` — Laravel (port **8000**), which has *its own* `package.json` for a
  Blade/Tailwind scaffold that is **not** the app

> **`composer dev` is a trap.** It starts the Laravel scaffold's Vite, not the
> SPA. Use `make dev`.

## The four things that break a fresh clone

All four are handled by `make setup`. Listed so the failure modes are
recognisable:

1. **`APP_KEY` is empty** → `php artisan key:generate`.
2. **`ADMIN_EMAILS` was absent from `.env.example`** → the admin console 403s
   with no hint. Now documented; still empty by default (fails closed).
3. **`VITE_API_URL` had no example file** → a production build silently points
   at `localhost:8000`. Set it for any non-local deploy.
4. **`bootstrap/cache` and `storage/framework/*` are gitignored** →
   `package:discover` fails cryptically until they exist.

## Tests

```bash
make test        # both suites
make test-web    # vitest      — 38 files, 255 tests
make test-api    # PHPUnit     — 47 tests
make build       # tsc + vite  — MUST pass; CI no longer tolerates failure (B9)
```

## Admin access

Put your email in `ADMIN_EMAILS` in `v2/api/.env`, then register that same email
in the app. The allowlist is checked by `EnsureIsAdmin`.

> **Known defect (B7):** email verification is off and admin identity is just an
> email string, so an allowlisted address that hasn't registered yet can be
> claimed by anyone. Register your admin account before exposing the app. Closed
> by the `AUTH-` cluster in M3.

## Layout

```
v1/   frozen. Shipped to staging. Mined for iman-ui.css + the corpus compiler.
v2/   the working app, and v3's port source. NEVER edited by v3 work.
v3/   docs today; the Next.js rebuild lands here.
```

See `v3/docs/BUILD-PLAN.md` for what's being built and in what order.
