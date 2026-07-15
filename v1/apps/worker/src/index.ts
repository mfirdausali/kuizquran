// Hono app: /auth/google, /events (+ /events/count), health. Origin-checked
// POSTs; session-derived user_id. CORS allows the credentialed cross-origin
// fetch from the web app's allow-listed origins.

import { Hono } from "hono";
import type { Env } from "./env.ts";
import { originCheck, requireSession, requireAdmin, allowedOrigins } from "./middleware.ts";
import { authGoogle } from "./auth.ts";
import { getEvents, getEventsCount, postEvents } from "./events.ts";
import { adminHome, adminUser } from "./admin.ts";
import { getSettings, postSettings } from "./settings.ts";

export { UserDO } from "./userDO.ts";

type Vars = { Variables: { uid: number }; Bindings: Env };

const app = new Hono<Vars>();

// CORS for credentialed cross-origin requests from the web app.
app.use("*", async (c, next) => {
  const origin = c.req.header("Origin");
  const allowed = allowedOrigins(c.env);
  if (origin && allowed.includes(origin)) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Vary", "Origin");
  }
  if (c.req.method === "OPTIONS") {
    c.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    c.header("Access-Control-Allow-Headers", "content-type");
    return c.body(null, 204);
  }
  return next();
});

// The standalone worker serves un-prefixed routes. In production the Pages
// _worker.js strips the /api prefix and forwards here via a service binding, so
// the browser talks to the same site (iman-quiz.pages.dev/api/*) and the session
// cookie SameSite=Lax works (PRD FR7). Local dev calls these directly on :8787.
app.get("/health", (c) => c.json({ ok: true }));

// Who am I? Restores signed-in state on reload from the HttpOnly session cookie
// (no re-prompt), and reports whether the account has server-side history (so a
// returning user skips onboarding). Returns { signedIn:false } when no session.
app.get("/me", async (c) => {
  const cookie = c.req.header("Cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)iman_session=([^;]+)/);
  if (!m) return c.json({ signedIn: false });
  const { verifySession } = await import("./session.ts");
  const uid = await verifySession(m[1]!, c.env.SESSION_SECRET, Math.floor(Date.now() / 1000));
  if (uid === null) return c.json({ signedIn: false });
  const user = await c.env.DB.prepare("SELECT email, anchor_hour FROM users WHERE id = ?")
    .bind(uid)
    .first<{ email: string; anchor_hour: number }>();
  const cnt = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM events WHERE user_id = ?")
    .bind(uid)
    .first<{ n: number }>();
  return c.json({
    signedIn: true,
    email: user?.email ?? null,
    anchorHour: user?.anchor_hour ?? null,
    hasHistory: (cnt?.n ?? 0) > 0,
  });
});

// Auth: origin-checked, no session required (this is where the session is minted).
app.post("/auth/google", originCheck, authGoogle);

// Events: origin-checked + session-required; user_id from the cookie.
app.post("/events", originCheck, requireSession, postEvents);
app.get("/events", requireSession, getEvents);
app.get("/events/count", requireSession, getEventsCount);

// User settings (FR9): the daily anchor hour. Session-gated; POST origin-checked.
app.get("/settings", requireSession, getSettings);
app.post("/settings", originCheck, requireSession, postSettings);

// Admin monitor (FR8): session + ADMIN_EMAILS gated; read-only. GET only.
app.get("/admin", requireSession, requireAdmin, adminHome);
app.get("/admin/user/:id", requireSession, requireAdmin, adminUser);

export default app;
