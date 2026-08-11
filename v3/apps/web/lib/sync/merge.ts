"use client";

// `mergeFromServer` — DEFECTS.md#B5's ACTUAL FIX.
//
// B5, verbatim:
//
//     `db/eventLog.ts:113` — `const { seq: _drop, ...rest } = e`, so IndexedDB
//     assigns a fresh local `seq` and LOG ORDER BECOMES ARRIVAL ORDER. Two
//     devices with byte-identical event sets would order differently.
//
//     Closes when: merge preserves `deviceSeq` and a two-device test yields
//     identical folds regardless of arrival order.
//
// v3 already removed the FOUNDATION of the v2 bug — the events store is keyed
// on the uuid, "NOT `seq` (arrival order, DEFECTS#B5, the exact bug) and NOT
// autoIncrement" (db.ts:66-69) — so B5 cannot reproduce by the identical
// mechanism. But it is reproducible here by three DIFFERENT mechanisms, and
// this function must close all three:
//
//   1. DROPPING `deviceSeq`. `canonicalKey` writes `e.deviceSeq ?? 0`, so every
//      foreign device's events collapse into one tie-broken-by-uuid bucket.
//      Order becomes uuid order — arbitrary but STABLE, which is the worst
//      kind of bug, because a two-device test comparing two arrival orders of
//      the same damaged merge still passes.
//   2. DROPPING `deviceId`. `canonicalKey` writes `""`, so two devices'
//      events interleave as ONE stream ordered by deviceSeq collisions.
//   3. THE INVISIBLE ONE — falling out of the `by_ts` index. schema.ts:118-123:
//      "An index key cannot contain `undefined` in IndexedDB — a record with
//      an undefined member of a compound keyPath is simply NOT INDEXED and
//      would silently vanish from a `by_ts` cursor." Such a row is not merely
//      mis-ordered, it is ABSENT from every canonical read. `read.ts`'s
//      count-mismatch fallback catches it, but that is a safety net, not a
//      licence.
//
// THE RULE THIS FUNCTION IS BUILT ON: the merged row is the wire verbatim plus
// `syncedAt`. THERE IS NO OMIT LIST ANYWHERE IN THIS FILE. The v2 bug was one
// `const { seq: _drop, ...rest } = e`; the v3 rule is not "omit the right
// fields" but "never omit". check-boundaries.mjs clause 7 greps for that
// gesture in this module and fails the build, making B5's literal syntax
// unwritable rather than merely tested-against.
//
// The legacy `seq?: number` field still exists on `DrillEvent` ("Monotonic
// per-session sequence, assigned by the event log on append"). v3's store
// never writes it and `canonicalKey` never reads it. We COPY it if present
// (harmless provenance) and never use it for ordering. NEVER RE-DERIVE IT,
// NEVER STRIP IT — stripping is B5's exact gesture, re-deriving is B5's exact
// bug.

import type { IDBPObjectStore } from "idb";
import type { DrillEvent } from "@engine/types.ts";
import { openDb } from "@/lib/idb/db";
import type { Iq3Schema, LocalEventRow } from "@/lib/idb/schema";
import { eventDigest } from "./digest.ts";

/** The two stores the merge writes, as typed by `idb` inside a readwrite
 *  transaction over both. Named only so `mergePage` can be split out of
 *  `mergeFromServer` without widening anything to `any`. */
type MergeStores = ["events", "meta"];
type EventsStore = IDBPObjectStore<Iq3Schema, MergeStores, "events", "readwrite">;
type MetaStore = IDBPObjectStore<Iq3Schema, MergeStores, "meta", "readwrite">;

/**
 * A #50 divergence: the server holds a row with an id we already have, but a
 * DIFFERENT payload.
 *
 *     | 50 | merge sees existing id | sync | divergent payload silently
 *       dropped | skip only on payload-digest match; mismatch alerts | M6 |
 */
export interface Divergence {
  id: string;
  localDigest: string;
  serverDigest: string;
  seenAt: number;
}

export interface MergeResult {
  /** Rows written that were not present locally. */
  inserted: number;
  /** Rows already present with a MATCHING payload — the idempotent path. */
  skipped: number;
  /** Rows already present with a DIFFERENT payload. Never dropped silently,
   *  never silently overwritten: the local row stays live and this is raised. */
  divergences: Divergence[];
  /** Rows whose `ts` is implausibly far in the future (#111). Accepted and
   *  flagged, NEVER rejected and NEVER rewritten. */
  futureTs: string[];
}

/**
 * #111's plausibility bound: "Far-future client ts | be | permanent spacing
 * poison | accept + flag; fold clamps spacing at received_at; skew measured
 * client-now vs server-now, not per-event".
 *
 * One year ahead of the merge's `now`. Generous on purpose — this flags a
 * clock set to 2030, not a device a few hours off.
 */
export const FUTURE_TS_TOLERANCE_MS = 365 * 24 * 60 * 60 * 1000;

export interface MergeContext {
  /** Merge time, stamped into `syncedAt`. Passed in, never read from the
   *  machine inside a function the tests need to be deterministic about. */
  now: number;
  /** The pull cursor to commit ALONGSIDE these events, in the SAME
   *  transaction. Omit to leave the cursor untouched. */
  cursor?: number;
  /** Which identity that cursor belongs to. */
  identity?: string | null;
}

/**
 * Merge one pulled page into the local log.
 *
 * ONE readwrite transaction over ["events","meta"] for the whole page, so the
 * cursor advance and the event writes commit together or not at all. That is
 * the same gesture `append()` already uses for `deviceSeq` ("so a crash can
 * never produce a GAP or a DUPLICATE").
 */
export async function mergeFromServer(
  events: readonly DrillEvent[],
  ctx: MergeContext,
): Promise<MergeResult> {
  const result: MergeResult = { inserted: 0, skipped: 0, divergences: [], futureTs: [] };
  const db = await openDb();
  const tx = db.transaction(["events", "meta"], "readwrite");
  // `idb` creates `tx.done` eagerly, at transaction creation. Touch it on the
  // very next line — before any request is issued and therefore before any
  // abort can reject it — so the promise is never momentarily handler-less.
  const settled = tx.done.then(
    () => false,
    () => true,
  );
  const store = tx.objectStore("events");
  const meta = tx.objectStore("meta");

  // ALL-OR-NOTHING. A throw anywhere in the loop must ABORT the transaction
  // explicitly, not merely propagate: IndexedDB does not roll back on an
  // exception in the caller's own code, so without this abort a page could
  // commit the rows written before the failure AND (worse) commit the cursor,
  // which would claim to have consumed events that were never stored.
  // Found by mutation M20 — see the mutation report.
  //
  // ONE handler on `tx.done`, attached UP FRONT — before any write can fail —
  // and it is the ONLY thing that ever awaits that promise.
  //
  // Two reasons it must be exactly one, attached first:
  //   - `tx.done` rejects the moment the transaction aborts. Attaching a
  //     handler afterwards is already too late: the rejection has been
  //     reported as unhandled by then.
  //   - awaiting `tx.done` in one place and `.catch()`-ing it in another
  //     creates a SECOND rejected promise with no handler, which is the same
  //     unhandled rejection wearing a different hat.
  //
  // `settled` resolves to TRUE when the transaction rolled back and FALSE
  // when it committed. It is attached above, at transaction-creation time.
  try {
    await mergePage(events, ctx, store, meta, result);
  } catch (err) {
    try {
      tx.abort();
    } catch {
      // Already aborted or already finished — nothing further to undo.
    }
    // Wait for the rollback to actually settle before propagating, so the
    // caller never sees the error while the write is still in flight.
    await settled;
    throw err;
  }

  if (await settled) {
    // The transaction failed to commit for a reason the loop never saw (a
    // quota abort at commit time, for instance). Nothing was written — say so
    // rather than returning a result that claims rows were inserted.
    throw new Error("merge transaction aborted — no rows and no cursor were committed");
  }
  return result;
}

/** The per-page loop. Split out only so the caller can wrap it in the abort
 *  guard above; it is not independently meaningful. */
async function mergePage(
  events: readonly DrillEvent[],
  ctx: MergeContext,
  store: EventsStore,
  meta: MetaStore,
  result: MergeResult,
): Promise<void> {
  for (const e of events) {
    // PRESERVE THE WIRE VERBATIM. Every field — deviceId, deviceSeq, ts, id,
    // visitOrdinal, siteKey, tz, corpusHash, locale, gradeClass, specSnapshot,
    // and the legacy seq — is copied unchanged by the spread. `syncedAt` is
    // the ONLY local field written, and it is not a wire field (`toWire()`
    // strips it): a row that came FROM the server is by definition synced and
    // must never be pushed back.
    let row: LocalEventRow = { ...e, syncedAt: ctx.now };

    // CONCRETENESS GUARANTEE, mirroring append.ts:160-164's own defence. A
    // member of the by_ts compound keyPath that is undefined makes the row
    // UNINDEXED and therefore invisible to every canonical read. Pre-selection
    // -era events (#58) are the legitimate case — "fold ignores extra fields;
    // site treated unvisited" — and they must still SORT, deterministically,
    // exactly as the fold-runner's canonicalOrder.ts documents ("Missing
    // deviceId/deviceSeq/id sort as if ""/0/"" — still a TOTAL, deterministic
    // order, never a crash"). The client and the worker must agree here or the
    // two-device check is meaningless. This is that agreement.
    //
    // Note this writes a CONCRETE DEFAULT for an ABSENT field. It never
    // rewrites a value the server actually sent — that would be the merge
    // inventing history.
    if (typeof row.ts !== "number") row = { ...row, ts: 0 };
    if (typeof row.deviceId !== "string") row = { ...row, deviceId: "" };
    if (typeof row.deviceSeq !== "number") row = { ...row, deviceSeq: 0 };
    if (typeof row.id !== "string" || row.id === "") {
      // No uuid ⇒ no idempotency key ⇒ nothing safe to do. Skip rather than
      // invent one: a synthesised uuid would re-merge as a NEW row on every
      // pull and duplicate the event forever.
      continue;
    }

    // #111: ACCEPT AND FLAG. Never mutate a stored `ts` — it is a wire field
    // and provenance, and rewriting it would make client and server disagree
    // about the same uuid's payload, which the digest below would then
    // correctly report as a #50 divergence. Two bugs for the price of one.
    // Clamping is the FOLD's job, not the merge's (#111: "fold clamps spacing
    // at received_at"), and `received_at` is a server column absent from the
    // wire shape — so the client could not clamp to it even if it wanted to.
    if (row.ts > ctx.now + FUTURE_TS_TOLERANCE_MS) result.futureTs.push(row.id);

    const existing = await store.get(row.id);
    if (!existing) {
      await store.put(row);
      result.inserted += 1;
      continue;
    }

    // #50: skip ONLY on payload-digest match.
    if (eventDigest(existing) === eventDigest(row)) {
      // Idempotent re-merge. If the local row is still pending, mark it
      // synced opportunistically — the server demonstrably has it.
      if (existing.syncedAt == null) await store.put({ ...existing, syncedAt: ctx.now });
      result.skipped += 1;
      continue;
    }

    // DIVERGENT PAYLOAD. Never silently drop, never silently overwrite. KEEP
    // THE LOCAL ROW as the live one: it is what this learner's device actually
    // observed and what its atoms were folded from, and overwriting it with a
    // foreign payload would retroactively change history the learner already
    // saw. The alert is the product surface; the resolution is a human/M8
    // admin question, not something to guess at 3am in a merge function.
    //
    // Critically, this does NOT stop the rest of the page merging. One
    // poisoned uuid wedging the pull is edge case #110's wedge in a different
    // costume.
    result.divergences.push({
      id: row.id,
      localDigest: eventDigest(existing),
      serverDigest: eventDigest(row),
      seenAt: ctx.now,
    });
  }

  // The cursor advances in THIS transaction. A separate transaction would
  // permit a crash between the writes and the advance, losing every event on
  // this page while claiming to have consumed them.
  if (ctx.cursor !== undefined) {
    await meta.put({ key: "pullCursor", value: ctx.cursor });
    await meta.put({ key: "pullCursorIdentity", value: ctx.identity ?? null });
  }
}
