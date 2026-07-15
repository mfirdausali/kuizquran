// Outbox — pushes unsynced events to the worker's /events in batches, idempotent
// by the client-stamped event id. Offline-safe: local commit (invariant #2) is
// unchanged; sync is a best-effort background push that retries when online.
// No tokens are stored client-side — the session cookie (credentials:'include')
// carries identity.

import type { DrillEvent } from "engine";
import { getUnsynced, markSynced, mergeFromServer } from "../db/eventLog.ts";

/** API base URL. Same-origin `/api` by default (Pages Function on the same site →
 *  SameSite=Lax cookie works). Local dev overrides via VITE_WORKER_URL (e.g.
 *  http://localhost:8787/api). An empty/unset VITE_WORKER_URL falls back to
 *  `/api` — NOT "" (which would drop the prefix and 405 on Pages). */
export const WORKER_URL: string =
  (import.meta.env.VITE_WORKER_URL as string | undefined)?.trim() || "/api";

const BATCH = 200;

/** Map a stored event to the wire shape the worker expects. */
function toWire(e: DrillEvent) {
  return {
    id: e.id,
    type: e.type,
    ts: e.ts,
    surah: e.surah,
    ayah: e.ayah,
    rung: e.rung,
    position: e.position,
    choice: e.choice,
    correct: e.correct,
    pretest: e.pretest,
    to: e.to,
    stepKind: e.stepKind,
    structured: e.structured,
    latency: e.latency,
    resume: e.resume,
  };
}

/**
 * Flush all unsynced events to the worker in batches. Returns the number synced.
 * On network/auth failure it stops quietly (events stay unsynced for next time).
 * `signedIn` must be true (there's a session cookie) — otherwise a no-op.
 */
export async function flush(signedIn: boolean): Promise<number> {
  if (!signedIn) return 0;
  const unsynced = await getUnsynced();
  if (unsynced.length === 0) return 0;

  let total = 0;
  for (let i = 0; i < unsynced.length; i += BATCH) {
    const chunk = unsynced.slice(i, i + BATCH);
    let res: Response;
    try {
      res = await fetch(`${WORKER_URL}/events`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events: chunk.map(toWire) }),
      });
    } catch {
      break; // offline — try again later
    }
    if (!res.ok) break; // 401/403/5xx — stop; retry later
    await markSynced(chunk.map((e) => e.id));
    total += chunk.length;
  }
  return total;
}

/**
 * Server→client hydrate. Pulls the signed-in user's full event history from the
 * account (GET /events) and merges any events missing locally into IndexedDB
 * (idempotent by id). This is what restores progress on a fresh device / cleared
 * storage — the dashboard and scheduler read local atoms, so without this a new
 * browser shows 0/111 even though the account has history. Returns the number of
 * events newly added locally (0 on no-op / not-signed-in / network failure).
 */
export async function hydrate(signedIn: boolean): Promise<number> {
  if (!signedIn) return 0;
  let res: Response;
  try {
    res = await fetch(`${WORKER_URL}/events`, { credentials: "include" });
  } catch {
    return 0; // offline — the local log stands; try again next sign-in/focus
  }
  if (!res.ok) return 0;
  const body = (await res.json()) as { events?: DrillEvent[] };
  if (!Array.isArray(body.events)) return 0;
  return mergeFromServer(body.events);
}
