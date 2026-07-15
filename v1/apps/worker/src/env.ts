// Worker environment bindings + vars/secrets.

export interface Env {
  DB: D1Database;
  USER_DO: DurableObjectNamespace;

  // vars (wrangler.jsonc)
  ALLOWED_ORIGINS: string; // comma-separated
  GOOGLE_MOCK: string; // "1" enables the dev-only mock verifier

  // secrets (.dev.vars locally; `wrangler secret put` in staging/prod)
  SESSION_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  ADMIN_EMAILS: string; // comma-separated (used by v0.6 /admin)
}
