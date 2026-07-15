// User settings (FR9). The one persisted setting is the daily anchor hour — the
// secular time anchor (D16/D34: NOT a prayer name). Session-gated; user_id from
// the cookie, never the body. Origin-checked at the route.

import type { Context } from "hono";
import type { Env } from "./env.ts";

export async function getSettings(
  c: Context<{ Bindings: Env; Variables: { uid: number } }>,
): Promise<Response> {
  const uid = c.get("uid");
  const row = await c.env.DB.prepare("SELECT anchor_hour FROM users WHERE id = ?")
    .bind(uid)
    .first<{ anchor_hour: number }>();
  return c.json({ anchorHour: row?.anchor_hour ?? 4.5 });
}

export async function postSettings(
  c: Context<{ Bindings: Env; Variables: { uid: number } }>,
): Promise<Response> {
  const uid = c.get("uid");
  let anchorHour: number;
  try {
    const body = (await c.req.json()) as { anchorHour?: number };
    if (typeof body.anchorHour !== "number") return c.json({ error: "anchorHour (number) required" }, 400);
    anchorHour = body.anchorHour;
  } catch {
    return c.json({ error: "bad body" }, 400);
  }
  // Clamp to a valid local hour [0, 24).
  if (!(anchorHour >= 0 && anchorHour < 24)) return c.json({ error: "anchorHour out of range" }, 400);

  await c.env.DB.prepare("UPDATE users SET anchor_hour = ? WHERE id = ?").bind(anchorHour, uid).run();
  return c.json({ ok: true, anchorHour });
}
