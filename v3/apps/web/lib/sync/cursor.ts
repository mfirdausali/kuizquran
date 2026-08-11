"use client";

// The pull cursor and the outbox's low-water hint. Both live in the `meta`
// store; neither is in localStorage, and the reason differs per key.
//
// THE PULL CURSOR is the SERVER INGEST SEQUENCE (`id`), never `ts`. v3-D31's
// decisive case, restated so the client side cannot get it wrong: a second
// device offline for three days emits events with THREE-DAY-OLD `ts` values.
// When it finally uploads they get BRAND-NEW autoincrement `id`s. A client
// holding a `ts` cursor at "now" would ask `since=<now>` and the server would
// answer "nothing" — those three days are skipped FOREVER.
//
// Edge case #132 names it exactly: "cursor = server-assigned monotonic ingest
// sequence, not (ts,uuid); fold re-sorts canonically." The second half is the
// part people drop: THE CURSOR ORDERS THE TRANSPORT, CANONICAL ORDER ORDERS
// THE FOLD. Two different orders, both needed. Pulled events arrive in `id`
// order and are then read back in `(ts, deviceId, deviceSeq, id)` order by the
// `by_ts` index. Nothing re-sorts by arrival.
//
// It lives in `meta` because it MUST advance in the same readwrite transaction
// that writes the events it describes. localStorage cannot participate in an
// IndexedDB transaction, so a crash between the two would advance the cursor
// past events never written — permanent silent loss. Cursor advance is a
// COMMIT, not an intent: crash mid-page ⇒ the page is re-pulled ⇒ every row
// hits the merge's idempotent path. Re-pull is free; skipped pull is
// unrecoverable.

import { openDb } from "@/lib/idb/db";

/**
 * Read the cursor, scoped to an identity.
 *
 * A cursor from a DIFFERENT identity is discarded and 0 is returned. Getting
 * this backwards either re-pulls everything (slow, harmless) or skips a new
 * account's entire history (silent, fatal) — so when in doubt, RESET. A
 * stale-high cursor under a new identity is the one genuinely unrecoverable
 * state in the pull path.
 */
export async function readPullCursor(identity: string | null): Promise<number> {
  const db = await openDb();
  const stored = await db.get("meta", "pullCursorIdentity");
  const storedIdentity = typeof stored?.value === "string" ? stored.value : null;
  if (storedIdentity !== (identity ?? null)) return 0;
  const row = await db.get("meta", "pullCursor");
  return typeof row?.value === "number" ? row.value : 0;
}

/**
 * Reset the cursor for a new identity. Called on every re-mint (a fresh
 * anonymous user's ingest sequence starts at 0) and on a login to a different
 * account.
 *
 * NOTE what is NOT reset: the OUTBOX. Pending local events re-push under the
 * new identity, which is `AuthController::login()`'s own documented behaviour
 * ("any not-yet-synced local events simply sync under whichever account is
 * signed in when the outbox next flushes"). Already-synced rows are not
 * re-pushed, so a re-mint SPLITS a learner's server-side history across two
 * anonymous users. The LOCAL log stays complete and correct (invariant #2
 * makes it truth), so nothing the learner sees breaks; reunifying server-side
 * history is the account-adoption merge job, M6's other half, not this step.
 */
export async function resetPullCursor(identity: string | null): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("meta", "readwrite");
  await tx.store.put({ key: "pullCursor", value: 0 });
  await tx.store.put({ key: "pullCursorIdentity", value: identity ?? null });
  await tx.done;
}

/** The outbox's low-water hint. Absent ⇒ 0 ⇒ a full scan, which is the
 *  correct fallback: the hint is an optimization and never a boundary. */
export async function readOutboxLowWater(): Promise<number> {
  const db = await openDb();
  const row = await db.get("meta", "outboxLowWater");
  return typeof row?.value === "number" ? row.value : 0;
}

/**
 * Advance the hint — ONLY ever to a value proven to have nothing pending
 * below it. `Math.max` against the stored value so a concurrent writer cannot
 * move it backwards, and the caller's own proof is what makes the forward move
 * legitimate.
 */
export async function writeOutboxLowWater(deviceSeq: number): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("meta", "readwrite");
  const row = await tx.store.get("outboxLowWater");
  const current = typeof row?.value === "number" ? row.value : 0;
  if (deviceSeq > current) await tx.store.put({ key: "outboxLowWater", value: deviceSeq });
  await tx.done;
}
