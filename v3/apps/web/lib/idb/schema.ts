"use client";

// The IndexedDB schema for the v3 client event log.
//
// Invariant #2: THE EVENT LOG IS TRUTH; atoms is a rebuildable cache.
//
// The event row type is `DrillEvent` IMPORTED FROM THE ENGINE (v3-D10's frozen
// wire). It is never redeclared here — a second declaration is how a wire
// silently forks. If a field is missing, the fix is in the engine (and that is
// a STOP-and-report, not an edit).

import type { DBSchema } from "idb";
import type { DrillEvent } from "@engine/types.ts";

/** The database name. Deliberately NOT any v2 database name: v3-D23 is
 *  greenfield data with no v2 migration, and a shared name would risk a v2 log
 *  being reinterpreted under v3 semantics on a device that ran both. */
export const DB_NAME = "iq3";
export const DB_VERSION = 1;

/**
 * A stored event row: the frozen wire shape PLUS one local-only field.
 *
 * `syncedAt` is LOCAL ONLY. It is not a wire field, and it MUST be stripped
 * before any sync push — adding a field to the wire is a v3-D10 violation.
 * The two types are kept distinct precisely so they are never conflated:
 * `DrillEvent` is what crosses the wire, `LocalEventRow` is what sits on disk.
 *
 * The outbox that drains it shipped in M6/step 21 and lives in `lib/sync/`,
 * where `syncedAt == null` means PENDING (v3-D51). Note there is deliberately
 * NO `by_syncedAt` index and there should not be: IndexedDB cannot index
 * `null`, so such an index would hold exactly the SYNCED rows and omit the
 * pending ones — the opposite of what an outbox needs. The drain scans
 * `by_deviceSeq` instead.
 */
export type LocalEventRow = DrillEvent & { syncedAt?: number | null };

/** Keys of the tiny key/value `meta` store. */
export type MetaKey =
  | "deviceId"
  | "deviceSeq"
  | "schemaVersion"
  | "onboardedAt"
  | "glossLang"
  | "tz"
  | "writerId"
  | "writerHeartbeatAt"
  // --- build-plan step 21 (M6, sync). No DB_VERSION bump: `meta` is
  // `{key: string}`-keyed and un-indexed, so a new key needs no migration. ---
  /** The pull cursor: the SERVER INGEST SEQUENCE (`id`) of the last event
   *  merged, never a `ts` (v3-D31 / edge case #132). Lives here rather than in
   *  localStorage because it MUST advance in the same IndexedDB transaction
   *  that writes the events it describes — localStorage cannot participate in
   *  one, and a crash between the two would advance the cursor past events
   *  never written, which is permanent silent loss. */
  | "pullCursor"
  /** Which server identity `pullCursor` belongs to. A cursor is meaningless
   *  across users (`GET /api/events` is `where('user_id', $userId)`), so a
   *  changed identity resets the cursor to 0. */
  | "pullCursorIdentity"
  /** PERFORMANCE HINT ONLY, never a correctness boundary: the smallest
   *  deviceSeq that might still be pending. It may be wrong-LOW (costing a
   *  longer scan) but is only ever advanced to a value proven to have nothing
   *  pending below it, so it can never be wrong-HIGH (costing an event). A
   *  full scan is the fallback whenever it is absent. This is the crucial
   *  difference from a high-water sync cursor, which WOULD lose the
   *  out-of-order rows a retried append re-submits. */
  | "outboxLowWater";

export interface MetaRow {
  key: MetaKey;
  value: string | number | null;
}

/** A cached atom. This store is a CACHE, never truth: it must be safe to
 *  clear() and rebuild from `events` at any moment. Never write an atom the
 *  log does not imply. */
export interface AtomRow {
  /** `${surah}:${kind}:${ref}` — E-01 surah-keyed. */
  atomKey: string;
  surah: number;
  state: unknown;
}

/** A pinned corpus. Content-addressed by its 16-hex hash so a session can be
 *  pinned to the corpus it STARTED with (edge cases #16/#29): swapping corpora
 *  mid-session is forbidden, only at a session boundary. */
export interface CorpusRow {
  corpusHash: string;
  surah: number;
  storedAt: number;
  payload: unknown;
}

/** An assembled session: what /quiz/[sessionId] reads on mount and what the
 *  `pageshow` bfcache handler re-reads (edge case #93). */
export interface SessionRow {
  sessionId: string;
  surah: number;
  corpusHash: string;
  startedAt: number;
  cursor: number;
  queue: unknown[];
  lockOwner?: string | null;
}

export interface Iq3Schema extends DBSchema {
  events: {
    // keyPath is the uuid `id`, NOT `seq` and NOT autoIncrement. The uuid is
    // the idempotency key for server sync, so keying on it makes a re-append
    // of an already-seen event an idempotent `put` rather than a duplicate row.
    key: string;
    value: LocalEventRow;
    indexes: {
      /** v3-D09's canonical order, VERBATIM: (ts, deviceId, deviceSeq, id).
       *  Built as a compound index so canonical order is a property of the
       *  STORE rather than something every caller re-sorts and eventually gets
       *  wrong. Never `ts` alone — clocks skew and milliseconds tie. */
      by_ts: [number, string, number, string];
      /** E-01 scoping: the multi-surah dashboard reads per surah. */
      by_surah: number;
      /** Required by nextVisitOrdinal() = max(recorded for this site) + 1.
       *  Without this index that is a full-log scan on every question served. */
      by_siteKey: string;
      /** The outbox's ordering and the two-device determinism e2e. */
      by_deviceSeq: [string, number];
    };
  };
  meta: { key: string; value: MetaRow };
  atoms: { key: string; value: AtomRow; indexes: { by_surah: number } };
  corpus: { key: string; value: CorpusRow; indexes: { by_surah: number } };
  sessions: { key: string; value: SessionRow };
}

/**
 * The canonical sort key for an event row, v3-D09: `(ts, deviceId, deviceSeq, id)`.
 *
 * Missing deviceId/deviceSeq/id sort as ""/0/"" — still a TOTAL, deterministic
 * order, never a crash. This mirrors `v3/worker/fold-runner/src/canonicalOrder.ts`
 * exactly; the client and the server MUST agree on order or the two-device
 * determinism check is meaningless.
 *
 * An index key cannot contain `undefined` in IndexedDB — a record with an
 * undefined member of a compound keyPath is simply NOT INDEXED and would
 * silently vanish from a by_ts cursor. That is why `append()` always writes
 * concrete values for all four members.
 */
export function canonicalKey(e: LocalEventRow): [number, string, number, string] {
  return [e.ts, e.deviceId ?? "", e.deviceSeq ?? 0, e.id ?? ""];
}

/** Compare two rows in v3-D09 canonical order. */
export function compareCanonical(a: LocalEventRow, b: LocalEventRow): number {
  const ka = canonicalKey(a);
  const kb = canonicalKey(b);
  for (let i = 0; i < ka.length; i++) {
    const x = ka[i]!;
    const y = kb[i]!;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/** Strip every local-only field, yielding the frozen wire shape. Use this on
 *  ANY path that pushes to the server (M6). */
export function toWire(row: LocalEventRow): DrillEvent {
  const { syncedAt: _localOnly, ...wire } = row;
  return wire;
}
