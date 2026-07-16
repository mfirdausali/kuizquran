// Outbox — pushes unsynced events to the Laravel API in batches, idempotent by
// the client-stamped event id (v2-D18/ROADMAP Phase 5, ports v1's
// apps/web/src/sync/outbox.ts). Offline-safe: local commit (invariant #2) is
// unchanged; sync is a best-effort background push/pull. Bearer-token auth
// (sync/auth.ts) replaces v1's session cookie — no `credentials:'include'`,
// no origin-check surface (see v2-D51 in DECISIONS.md).

import type { DrillEvent } from "engine";
import { getUnsynced, markSynced, mergeFromServer } from "../db/eventLog.ts";
import { API_URL, getToken } from "./auth.ts";

const BATCH = 200;

/** Map a stored event to the wire shape the API expects (matches v1's
 *  WireEvent contract byte-for-byte — see v1/apps/worker/src/db.ts). */
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
    testKind: e.testKind,
    score: e.score,
    total: e.total,
    sentToReviews: e.sentToReviews,
  };
}

/**
 * Flush all unsynced events to the API in batches. Returns the number synced.
 * On network/auth failure it stops quietly (events stay unsynced for next
 * time) — this is exactly the "created offline, syncs on reconnect" exit
 * criterion: nothing here blocks or throws when the device has no
 * connectivity, it just leaves the outbox for the next call to pick up.
 * No-op (returns 0) if this device has no token yet — call ensureDevice() first.
 */
export async function flush(): Promise<number> {
  const token = getToken();
  if (!token) return 0;
  const unsynced = await getUnsynced();
  if (unsynced.length === 0) return 0;

  let total = 0;
  for (let i = 0; i < unsynced.length; i += BATCH) {
    const chunk = unsynced.slice(i, i + BATCH);
    let res: Response;
    try {
      res = await fetch(`${API_URL}/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
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
 * Server→client hydrate. Pulls this account's full event history (GET
 * /events) and merges any events missing locally into IndexedDB (idempotent
 * by id). This is what a SECOND DEVICE signed into the same account uses to
 * restore progress — the scheduler/report read local atoms, so without this a
 * fresh device shows 0/111 even though the account has history server-side.
 * Returns the number of events newly added locally (0 on no-op / no token /
 * network failure).
 */
export async function hydrate(): Promise<number> {
  const token = getToken();
  if (!token) return 0;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/events`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return 0; // offline — the local log stands; try again next time
  }
  if (!res.ok) return 0;
  const body = (await res.json()) as { events?: DrillEvent[] };
  if (!Array.isArray(body.events)) return 0;
  return mergeFromServer(body.events);
}
