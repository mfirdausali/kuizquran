"use client";

// The sync cycle: flush the outbox, then pull. Background reconciliation, never
// a precondition.
//
// #103, verbatim: "Outbox growth offline-for-days | fe | invisible risk | quiet
// 'N pending' indicator; NEVER BLOCKS A SESSION | M6".
//
// The app is offline-first by construction — invariant #2 makes the event log
// truth, so a session needs the network for nothing. Concretely, and these are
// obligations on the CALLER as much as on this file:
//
//   - NO session-assembly, drill, or grading path may await a flush or read the
//     pending count. The indicator is a passive observer.
//   - A flush failure is a COUNTER, not a dialog.
//   - `navigator.onLine` is a hint for SCHEDULING a flush, never a gate on
//     appending.
//
// #108, verbatim: "Partial batch retry | be | duplicates | PK (user_id, uuid)
// insertOrIgnore; IGNORED-WITH-MATCHING-DIGEST = SUCCESS | M3/M6".
//
// `{accepted: 0, ignored: 200}` means "the server already has all 200" and the
// rows get marked synced. Treating `ignored` as a failure produces an infinite
// re-send loop for an already-delivered batch — #110's wedge in another
// costume. The "with matching digest" half CANNOT be verified at push time:
// `EventsController::store()` returns only two integers and `insertOrIgnore`
// silently discards the incoming row on conflict, so the response cannot say
// WHICH uuids were ignored or whether the stored payload matched. That
// verification therefore happens ON THE PULL, in `mergeFromServer`, which sees
// the server's actual stored payload. This is stated plainly rather than left
// to the phrase "matching digest" implying a check that does not exist.

import type { DrillEvent } from "@engine/types.ts";
import { apiFetch, SyncAuthError, setIdentityChangeHandler } from "./apiFetch.ts";
import { getIdentity, getToken, hasLiveToken } from "./token.ts";
import { readPullCursor, resetPullCursor } from "./cursor.ts";
import { mergeFromServer, type Divergence } from "./merge.ts";
import {
  advanceLowWaterIfProven,
  chunk,
  countPending,
  markSynced,
  OUTBOX_BATCH_MAX,
  selectPending,
  type QuarantinedEvent,
} from "./outbox.ts";
import { assertWriter } from "@/lib/idb/writeLock";
import { toWire } from "@/lib/idb/schema";

/** Server page size. `pull_max_limit` is 1000 (`api/config/events.php`); we
 *  ask for the default 500 so a page merges in one reasonable transaction. */
export const PULL_PAGE_LIMIT = 500;

/** #108's retry policy: exponential backoff with jitter, capped. A failing
 *  flush never blocks, never surfaces a blocking error, and never retries so
 *  aggressively that an offline device burns battery. */
export const BACKOFF_BASE_MS = 2_000;
export const BACKOFF_MAX_MS = 5 * 60_000;

export interface PushResult {
  batches: number;
  accepted: number;
  ignored: number;
  marked: number;
  quarantined: QuarantinedEvent[];
  /** Set when the cycle stopped early. The session is unaffected either way. */
  degraded?: "auth" | "network" | "server" | "malformed";
}

export interface PullResult {
  pages: number;
  merged: number;
  skipped: number;
  divergences: Divergence[];
  futureTs: string[];
  cursor: number;
  degraded?: "auth" | "network" | "server";
}

export interface SyncContext {
  now: number;
}

/** The server's ingest response (EventsController::store). */
interface StoreResponse {
  accepted?: number;
  ignored?: number;
}

/** The server's pull page (EventsController::index). */
interface PullResponse {
  events?: DrillEvent[];
  nextCursor?: number;
  hasMore?: boolean;
}

/**
 * Drain the outbox.
 *
 * SERIAL, not parallel: one in-flight batch at a time, and only the WRITER tab
 * flushes. A reader tab that flushed would double-send (harmless — the uuid is
 * the idempotency key) but would also race the `syncedAt` writes, which is not
 * harmless.
 */
export async function pushOutbox(ctx: SyncContext): Promise<PushResult> {
  assertWriter();

  const result: PushResult = {
    batches: 0,
    accepted: 0,
    ignored: 0,
    marked: 0,
    quarantined: [],
  };

  // Drain until nothing sendable is left. Each pass selects at most one
  // batch's worth so a huge backlog is chunked without ever holding it all in
  // memory.
  for (;;) {
    const { rows, quarantined } = await selectPending(OUTBOX_BATCH_MAX);
    for (const q of quarantined) {
      if (!result.quarantined.some((existing) => existing.id === q.id)) {
        result.quarantined.push(q);
      }
    }
    if (rows.length === 0) break;

    // Batches are ≤200 by selection, but chunk() is applied anyway so the
    // constant is enforced at exactly one place and a future caller passing a
    // larger selection cannot silently exceed it.
    const batches = chunk(rows, OUTBOX_BATCH_MAX);
    let progressed = false;

    for (const batch of batches) {
      let response: Response;
      try {
        response = await apiFetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // `toWire` is the ISLAND's own function (schema.ts), the single
          // place that knows which fields are local-only. Re-implementing the
          // strip here — with the very destructuring gesture that caused B5 —
          // is how a wire silently forks.
          body: JSON.stringify({ events: batch.map(toWire) }),
        });
      } catch (err) {
        // A 401 that could not be recovered from, or a network failure. Both
        // are counters, never dialogs, and both leave every row PENDING — so
        // the next flush re-sends and the server ignores what it already has.
        result.degraded = err instanceof SyncAuthError ? "auth" : "network";
        return result;
      }

      if (response.status === 400) {
        // A malformed batch. `store()` returns 400 for 'every event needs a
        // string id' / 'events[] required'. Retrying it identically would
        // reproduce this forever — that is the QUARANTINE path, not the retry
        // path. Stop the cycle rather than spin.
        result.degraded = "malformed";
        return result;
      }

      if (!response.ok) {
        // 5xx and friends: backoff and retry on the NEXT cycle. Nothing is
        // marked, so nothing is lost.
        result.degraded = "server";
        return result;
      }

      const body = (await response.json()) as StoreResponse;
      const accepted = typeof body.accepted === "number" ? body.accepted : 0;
      const ignored = typeof body.ignored === "number" ? body.ignored : 0;
      result.accepted += accepted;
      result.ignored += ignored;
      result.batches += 1;

      // A 2xx means the server holds every uuid in this batch — whether it
      // stored them now (`accepted`) or already had them (`ignored`). #108:
      // ignored is SUCCESS. Mark only now, never before the POST.
      const ids = batch.map((r) => r.id).filter((id): id is string => typeof id === "string");
      await markSynced(ids, ctx.now);
      result.marked += ids.length;
      progressed = true;

      // The hint may advance only through the highest deviceSeq proven sent,
      // and never past anything still pending (a quarantined row stays
      // pending forever).
      const highest = batch.reduce(
        (max, r) => (typeof r.deviceSeq === "number" && r.deviceSeq > max ? r.deviceSeq : max),
        0,
      );
      const lowestQuarantined = lowestSeqOf(quarantined, rows);
      await advanceLowWaterIfProven(highest, quarantined, lowestQuarantined);
    }

    // Nothing moved this pass ⇒ everything left is quarantined ⇒ stop, or this
    // loop is the wedge.
    if (!progressed) break;
  }

  return result;
}

/** The deviceSeq of the earliest quarantined row, if it is in this selection. */
function lowestSeqOf(
  quarantined: readonly QuarantinedEvent[],
  rows: readonly { id?: string; deviceSeq?: number }[],
): number | null {
  if (quarantined.length === 0) return null;
  const ids = new Set(quarantined.map((q) => q.id));
  let lowest: number | null = null;
  for (const r of rows) {
    if (r.id && ids.has(r.id) && typeof r.deviceSeq === "number") {
      if (lowest === null || r.deviceSeq < lowest) lowest = r.deviceSeq;
    }
  }
  return lowest;
}


/**
 * Pull every page the server has past our cursor, merging each in its own
 * transaction.
 *
 * `hasMore` is `$rows->count() === $limit` server-side. Ignoring it and
 * pulling one page would silently stop at 500 events and never catch up.
 */
export async function pullFromServer(ctx: SyncContext): Promise<PullResult> {
  const identity = getIdentity() ?? getToken();
  let cursor = await readPullCursor(identity);

  const result: PullResult = {
    pages: 0,
    merged: 0,
    skipped: 0,
    divergences: [],
    futureTs: [],
    cursor,
  };

  for (;;) {
    let response: Response;
    try {
      response = await apiFetch(
        `/api/events?since=${cursor}&limit=${PULL_PAGE_LIMIT}`,
        { method: "GET" },
      );
    } catch (err) {
      result.degraded = err instanceof SyncAuthError ? "auth" : "network";
      return result;
    }
    if (!response.ok) {
      result.degraded = "server";
      return result;
    }

    const body = (await response.json()) as PullResponse;
    const events = Array.isArray(body.events) ? body.events : [];
    const nextCursor = typeof body.nextCursor === "number" ? body.nextCursor : cursor;

    // The merge commits the events AND the cursor in one transaction. Cursor
    // advance is a COMMIT, not an intent: a crash mid-page re-pulls the page
    // and every row hits the idempotent path.
    let merged;
    try {
      merged = await mergeFromServer(events, {
        now: ctx.now,
        cursor: nextCursor,
        identity,
      });
    } catch {
      // The write failed and the WHOLE transaction rolled back — events AND
      // cursor together. Stop the cycle without advancing anything: the page
      // is re-pulled next time and every row hits the idempotent path.
      // Re-pull is free; a skipped pull is unrecoverable.
      result.degraded = "server";
      return result;
    }

    result.pages += 1;
    result.merged += merged.inserted;
    result.skipped += merged.skipped;
    result.divergences.push(...merged.divergences);
    result.futureTs.push(...merged.futureTs);
    cursor = nextCursor;
    result.cursor = cursor;

    if (body.hasMore !== true) break;
    // A server that claims hasMore but returns nothing would loop forever.
    if (events.length === 0) break;
  }

  return result;
}

export interface CycleResult {
  push: PushResult | null;
  pull: PullResult | null;
  pending: number;
  divergences: Divergence[];
  quarantined: QuarantinedEvent[];
}

/**
 * One full reconciliation. Never throws into a caller: every failure is a
 * counter on the result. A session must be able to call this and ignore it
 * entirely.
 */
export async function syncCycle(ctx: SyncContext): Promise<CycleResult> {
  // A re-mint must reset the pull cursor (a fresh anonymous user's ingest
  // sequence starts at 0, so a carried-over cursor would skip its entire
  // history). Registered here rather than inside apiFetch so that module keeps
  // no dependency on the store.
  setIdentityChangeHandler(async (nextIdentity) => {
    await resetPullCursor(nextIdentity);
  });

  let push: PushResult | null = null;
  let pull: PullResult | null = null;

  try {
    push = await pushOutbox(ctx);
  } catch {
    // NotWriterError, or anything else. The session is untouched.
    push = null;
  }

  try {
    pull = await pullFromServer(ctx);
  } catch {
    pull = null;
  }

  let pending = 0;
  try {
    pending = await countPending();
  } catch {
    pending = 0;
  }

  return {
    push,
    pull,
    pending,
    divergences: pull?.divergences ?? [],
    quarantined: push?.quarantined ?? [],
  };
}

/** Backoff for attempt N (0-based), with jitter, capped. */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const exponential = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempt);
  // Full jitter: an offline fleet coming back at once must not stampede.
  return Math.floor(exponential * (0.5 + 0.5 * random()));
}

/** Whether it is worth attempting a cycle at all. A HINT for scheduling, never
 *  a gate on appending. */
export function shouldAttemptSync(): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  return hasLiveToken() || getToken() === null;
}
