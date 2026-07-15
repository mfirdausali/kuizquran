// Middleware: origin check on all POSTs (FR7) + session requirement.

import type { Context, Next } from "hono";
import type { Env } from "./env.ts";
import { COOKIE_NAME, verifySession } from "./session.ts";

export function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Reject any state-changing request whose Origin/Referer isn't allow-listed. */
export async function originCheck(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
  const method = c.req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();

  const allowed = allowedOrigins(c.env);
  const origin = c.req.header("Origin");
  const referer = c.req.header("Referer");
  const source = origin ?? (referer ? new URL(referer).origin : null);
  if (!source || !allowed.includes(source)) {
    return c.json({ error: "bad origin" }, 403);
  }
  return next();
}

/** Attach the authenticated uid from the session cookie, or 401. user_id NEVER
 *  comes from the request body. */
export async function requireSession(
  c: Context<{ Bindings: Env; Variables: { uid: number } }>,
  next: Next,
): Promise<Response | void> {
  const cookie = c.req.header("Cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return c.json({ error: "no session" }, 401);
  const nowS = Math.floor(Date.now() / 1000);
  const uid = await verifySession(match[1]!, c.env.SESSION_SECRET, nowS);
  if (uid === null) return c.json({ error: "invalid session" }, 401);
  c.set("uid", uid);
  return next();
}

/** Whether a user id belongs to the ADMIN_EMAILS allowlist (FR8). Fails closed
 *  (returns false) if the allowlist is unset/empty — never throws. */
export async function isAdmin(env: Env, uid: number): Promise<boolean> {
  const allow = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0) return false;
  const row = await env.DB.prepare("SELECT email FROM users WHERE id = ?")
    .bind(uid)
    .first<{ email: string }>();
  return row ? allow.includes(row.email.trim().toLowerCase()) : false;
}

/** Gate: requireSession must have run first (uid set). 403 if not an admin. */
export async function requireAdmin(
  c: Context<{ Bindings: Env; Variables: { uid: number } }>,
  next: Next,
): Promise<Response | void> {
  const uid = c.get("uid");
  if (!(await isAdmin(c.env, uid))) return c.text("forbidden", 403);
  return next();
}
