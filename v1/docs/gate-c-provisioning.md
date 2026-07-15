# GATE C — provisioning checklist (v0.5 auth + sync)

The v0.5 server scaffold is **built, tested, and demonstrated locally** (mock
Google verifier + local D1 + UserDO). To go to staging with **real** Google
sign-in and remote D1, you must provision the items below. I cannot enter these
secrets myself — you run the steps; I'll wire the results.

**What's already proven locally (no secrets needed):** sign-in → session cookie →
`/events` batch → local D1 (idempotent, routed through the per-user Durable
Object) → `/events/count`; origin check (403), no-session (401), user_id-from-
session (spoof ignored), anonymous-history adoption flush. 100 tests pass.

---

## 1. Google Cloud — OAuth 2.0 Client ID (Web)

1. Go to <https://console.cloud.google.com/> → create/select a project.
2. **APIs & Services → OAuth consent screen**: set app name, support email;
   add scopes **`openid`, `email`, `profile`** (nothing else — least scope, §8).
   Add your tester emails while in "Testing".
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins:** your web app origins, e.g.
     `http://localhost:5173` (local) and `https://iman-staging.pages.dev` (staging).
   - (Redirect URIs are not required for GIS ID-token / `credential` flow, but add
     the app origin if the console insists.)
4. Copy the **Client ID** → this is `GOOGLE_CLIENT_ID`.

**Give me:** `GOOGLE_CLIENT_ID`. (No client *secret* is needed for the ID-token
verification flow we use.)

## 2. ADMIN_EMAILS (for v0.6 /admin, captured now)

The comma-separated allow-list of admin emails (yours to start), e.g.
`mfirdaus12@gmail.com`.

**Give me:** `ADMIN_EMAILS`.

## 3. Session secret

A long random string used to sign session cookies (HMAC).

```sh
# generate one (don't paste it to me; put it straight into the secret store):
openssl rand -base64 32
```

**You set it** (do not send it to me):
```sh
cd apps/worker
wrangler secret put SESSION_SECRET            # local staging deploy
wrangler secret put SESSION_SECRET --env staging
```

## 4. Cloudflare — account, D1, secrets

1. `cd apps/worker && wrangler login` (opens browser; authorizes your account).
2. Create the remote D1 database:
   ```sh
   wrangler d1 create iman-db
   ```
   Copy the printed **`database_id`** → I'll put it in `wrangler.jsonc`
   (replacing the `PLACEHOLDER_LOCAL_ONLY`).
3. Apply migrations to remote:
   ```sh
   wrangler d1 migrations apply iman-db --remote
   ```
4. Set the secrets on staging:
   ```sh
   wrangler secret put GOOGLE_CLIENT_ID --env staging
   wrangler secret put SESSION_SECRET   --env staging
   wrangler secret put ADMIN_EMAILS     --env staging
   ```
5. Confirm `GOOGLE_MOCK=0` for staging (already set in `wrangler.jsonc`
   `env.staging.vars` — the mock verifier is disabled there).

**Give me:** the D1 `database_id`, your staging web origin (to set
`ALLOWED_ORIGINS`), and confirmation the secrets are set.

---

## What I do once you provide the above
1. Put the real `database_id` + staging origin into `wrangler.jsonc`.
2. Swap the client `SignIn` from the dev mock to the real GIS button using
   `GOOGLE_CLIENT_ID` (renders Google's ID-token flow → same `/auth/google`).
3. `wrangler deploy --env staging`; deploy the web app to Cloudflare Pages.
4. Verify a **real** Google sign-in → events land in **remote** D1
   (`wrangler d1 execute iman-db --remote --command "SELECT COUNT(*) FROM events"`).
5. Then, and only then, tag **v0.5** and update the progress ledger.

Until then, v0.5 status = **blocked-on-human** (scaffold committed, not tagged).
