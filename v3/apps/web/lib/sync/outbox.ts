"use client";

// THE OUTBOX. Edge cases #103, #108, #110.
//
// PENDING = `syncedAt == null`. The marker is a FLAG ON THE ROW, not a
// high-water cursor and not a second store. `lib/idb/schema.ts` already ships
// the field ("`syncedAt` is LOCAL ONLY... The outbox that drains this is
// M6/step 21") and `append.ts:126` writes `syncedAt: null` on every new row,
// so this builds on the island rather than forking it.
//
// WHY THE FLAG, AND NOT THE ALTERNATIVES:
//
//   FLAG ON THE ROW — a crash after the POST but before the flag-write leaves
//     rows pending, so they are RE-SENT. The server's `insertOrIgnore` on
//     `unique(user_id, uuid)` makes the re-send a no-op (`accepted:0,
//     ignored:N`). No double-send EFFECT, no loss. The asymmetry is the whole
//     point: the failure mode is re-send, and re-send is free because the uuid
//     IS the idempotency key. There is no failure mode that LOSES an event,
//     because a row is only marked synced AFTER a 2xx that included it.
//
//   A HIGH-WATER CURSOR (`lastSyncedDeviceSeq`) — FATAL. A row appended out of
//     deviceSeq order relative to the flush (a retried RetryableAppendError
//     re-submits an OLDER already-allocated deviceSeq — append.ts:148-150
//     deliberately reuses it) sits BELOW the high-water mark and is never
//     sent. Silent permanent loss.
//
//   A SEPARATE `outbox` STORE — two stores, two transactions, one crash window
//     between them ⇒ genuine loss or genuine duplication. Also forks the island.
//
// SELECTING PENDING ROWS: there is NO `by_syncedAt` index. `DB_VERSION` is 1
// and the events store has exactly four indexes. This is not an oversight to
// fix with a migration: IndexedDB CANNOT INDEX `null` — a record whose indexed
// value is null/undefined is simply not in the index — so a `by_syncedAt`
// index would contain exactly the SYNCED rows and omit the pending ones, the
// opposite of what an outbox needs. We therefore scan the `by_deviceSeq`
// compound index, which is already ordered exactly as the outbox wants to
// drain, bounded below by a hint that is never authoritative (see cursor.ts).

import { openDb } from "@/lib/idb/db";
import { toWire, type LocalEventRow } from "@/lib/idb/schema";
import { getDeviceId } from "@/lib/idb/append";
import { readOutboxLowWater, writeOutboxLowWater } from "./cursor.ts";

/**
 * #110, verbatim: "Batch >200 / event >8KB | be | permanently wedged sync |
 * CLIENT CHUNKING SHIPS FIRST; server cap log-only → then enforced; oversize
 * split/quarantine policy client-side | M3/M6".
 *
 * Named constants, never a literal at a call site.
 */
export const OUTBOX_BATCH_MAX = 200;
export const EVENT_BYTE_MAX = 8 * 1024;

/** A row too large to ever send. `specSnapshot` is the only unbounded field on
 *  the wire, so this is where an oversize event comes from. */
export interface QuarantinedEvent {
  id: string;
  bytes: number;
}

export interface PendingSelection {
  /** Sendable pending rows, in (deviceId, deviceSeq) order, oldest first. */
  rows: LocalEventRow[];
  /** Rows excluded because they exceed the byte budget. */
  quarantined: QuarantinedEvent[];
}

/** The wire byte size of one row — what the server would actually receive. */
export function wireBytes(row: LocalEventRow): number {
  const json = JSON.stringify(toWire(row));
  // TextEncoder gives real UTF-8 bytes; `.length` would undercount anything
  // non-ASCII, which for a `specSnapshot` carrying gloss text is most of it.
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(json).length;
  return json.length;
}

/**
 * Every pending row for THIS device, canonically drainable.
 *
 * Scans the `by_deviceSeq` index bounded to this deviceId, lower-bounded by
 * the low-water hint. The hint is a PERFORMANCE OPTIMIZATION ONLY: it is only
 * ever advanced to a value proven to have nothing pending below it, and a full
 * scan is the fallback whenever it is absent. It can be wrong-LOW (costing
 * time) but never wrong-HIGH (costing an event).
 */
export async function selectPending(limit = OUTBOX_BATCH_MAX): Promise<PendingSelection> {
  const db = await openDb();
  const deviceId = await getDeviceId();
  const lowWater = await readOutboxLowWater();

  const rows: LocalEventRow[] = [];
  const quarantined: QuarantinedEvent[] = [];

  const tx = db.transaction("events", "readonly");
  const index = tx.store.index("by_deviceSeq");
  // Bounded to THIS device: another device's rows arrived by merge and are
  // already `syncedAt`-stamped, so they are never pending — but scanning them
  // would still cost time on a shared log.
  const range = IDBKeyRange.bound([deviceId, lowWater], [deviceId, Infinity]);
  let cursor = await index.openCursor(range);
  while (cursor) {
    const row = cursor.value;
    // `== null` is deliberate and covers BOTH null and undefined. `append()`
    // writes `null`; a row that never went through append (or a future merge
    // path) could carry `undefined`. `!== undefined` here would make every
    // appended row look synced; `!== null` would make merged rows look
    // pending. Loose equality is the only predicate that is right for both.
    if (row.syncedAt == null) {
      const bytes = wireBytes(row);
      if (bytes > EVENT_BYTE_MAX) {
        // QUARANTINE, NOT SPLIT. A single row cannot be split — it is one
        // event — so the policy is to never send it and, crucially, to NEVER
        // LET IT BLOCK THE BATCH BEHIND IT. The wedge #110 names is precisely
        // a poison event at the head of the queue retried forever.
        quarantined.push({ id: row.id ?? "", bytes });
      } else if (rows.length < limit) {
        rows.push(row);
      } else {
        // Batch is full. Stop scanning: the next flush resumes from here.
        break;
      }
    }
    cursor = await cursor.continue();
  }
  await tx.done;

  return { rows, quarantined };
}

/** How many rows are waiting. #103's quiet count. */
export async function countPending(): Promise<number> {
  const db = await openDb();
  let n = 0;
  const tx = db.transaction("events", "readonly");
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (cursor.value.syncedAt == null) n += 1;
    cursor = await cursor.continue();
  }
  await tx.done;
  return n;
}

/**
 * Mark a batch synced AFTER a 2xx that included it.
 *
 * ONE readwrite transaction. Each row is READ-MODIFY-WRITTEN inside that
 * transaction — never a blind `put` of the object the outbox captured before
 * the POST. An event may have been re-appended meanwhile (append.ts:140-146
 * returns the EXISTING row on a duplicate id), and blind-putting a stale copy
 * would resurrect an old payload.
 */
export async function markSynced(ids: readonly string[], now: number): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb();
  const tx = db.transaction("events", "readwrite");
  for (const id of ids) {
    const current = await tx.store.get(id);
    if (!current) continue;
    await tx.store.put({ ...current, syncedAt: now });
  }
  await tx.done;
}

/**
 * Advance the low-water hint, but ONLY when the proof holds.
 *
 * The proof: the batch we just marked was drained in (deviceId, deviceSeq)
 * order starting at the current hint, and every row scanned below `throughSeq`
 * was either sent or quarantined. Quarantined rows are the exception that
 * makes this conditional — a quarantined row STAYS pending forever, so the
 * hint must never advance past one, or a later `syncedAt`-clearing repair
 * would leave it permanently unscanned.
 */
export async function advanceLowWaterIfProven(
  throughSeq: number,
  quarantined: readonly QuarantinedEvent[],
  lowestQuarantinedSeq: number | null,
): Promise<void> {
  if (quarantined.length > 0 && lowestQuarantinedSeq !== null) {
    // Never past the earliest thing still pending.
    if (lowestQuarantinedSeq <= throughSeq) return;
  }
  await writeOutboxLowWater(throughSeq);
}

/** Split a list into batches of at most `size`, preserving order. */
export function chunk<T>(items: readonly T[], size = OUTBOX_BATCH_MAX): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
