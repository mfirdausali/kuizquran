// POST /events — accept a batch of the user's events (append-only sync). The
// user_id comes from the session cookie (never the body). Writes are routed to
// the user's UserDO, which serializes them and idempotently persists to D1.
// GET /events/count — how many events the user has in D1 (exit-criterion demo).

import type { Context } from "hono";
import type { Env } from "./env.ts";
import type { WireEvent } from "./db.ts";
import { countEvents, selectEvents } from "./db.ts";

export async function postEvents(
  c: Context<{ Bindings: Env; Variables: { uid: number } }>,
): Promise<Response> {
  const uid = c.get("uid");
  let events: WireEvent[];
  try {
    const body = (await c.req.json()) as { events?: WireEvent[] };
    if (!Array.isArray(body.events)) return c.json({ error: "events[] required" }, 400);
    events = body.events;
  } catch {
    return c.json({ error: "bad body" }, 400);
  }

  // Guard: every event must carry a stable id (idempotency key).
  if (events.some((e) => !e.id || typeof e.id !== "string")) {
    return c.json({ error: "every event needs a string id" }, 400);
  }

  // Route to the user's Durable Object (serialized per user).
  const doId = c.env.USER_DO.idFromName(String(uid));
  const stub = c.env.USER_DO.get(doId);
  const res = await stub.fetch("https://do/ingest", {
    method: "POST",
    body: JSON.stringify({ userId: uid, events }),
    headers: { "content-type": "application/json" },
  });
  const result = (await res.json()) as { accepted: number; ignored: number };
  return c.json(result);
}

export async function getEventsCount(
  c: Context<{ Bindings: Env; Variables: { uid: number } }>,
): Promise<Response> {
  const uid = c.get("uid");
  const n = await countEvents(c.env.DB, uid);
  return c.json({ count: n });
}

// GET /events — the server→client hydrate pull. Returns ALL of the user's events
// (append-ordered) so a fresh device can reconcile its local log with the account.
// Session-required; user_id from the cookie. Read-only.
export async function getEvents(
  c: Context<{ Bindings: Env; Variables: { uid: number } }>,
): Promise<Response> {
  const uid = c.get("uid");
  const events = await selectEvents(c.env.DB, uid);
  return c.json({ events });
}
