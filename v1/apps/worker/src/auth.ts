// POST /auth/google — verify a Google ID token, upsert the user, set the session
// cookie (FR7). Scope is openid email profile (requested client-side by GIS).

import type { Context } from "hono";
import type { Env } from "./env.ts";
import { verifyGoogle } from "./verifyGoogle.ts";
import { upsertUser } from "./db.ts";
import { signSession, sessionCookie } from "./session.ts";

export async function authGoogle(c: Context<{ Bindings: Env }>): Promise<Response> {
  let credential: string;
  try {
    const body = (await c.req.json()) as { credential?: string };
    if (!body.credential) return c.json({ error: "missing credential" }, 400);
    credential = body.credential;
  } catch {
    return c.json({ error: "bad body" }, 400);
  }

  const nowMs = Date.now();
  let identity;
  try {
    identity = await verifyGoogle(credential, {
      mock: c.env.GOOGLE_MOCK === "1",
      clientId: c.env.GOOGLE_CLIENT_ID,
      nowMs,
    });
  } catch (e) {
    return c.json({ error: "verification failed", detail: String(e) }, 401);
  }

  const uid = await upsertUser(c.env.DB, identity.sub, identity.email, nowMs);
  const token = await signSession(uid, c.env.SESSION_SECRET, Math.floor(nowMs / 1000));
  const secure = new URL(c.req.url).protocol === "https:";
  c.header("Set-Cookie", sessionCookie(token, secure));
  return c.json({ ok: true, email: identity.email });
}
