"use client";

// Reads. Every one of them is wrapped in the wedge timeout by its caller
// (`readIntoState`), so a wedged IndexedDB can never hang the app.

import { nextVisitOrdinal } from "@engine/site.ts";
import { openDb } from "./db.ts";
import { compareCanonical, type LocalEventRow } from "./schema.ts";
import { readIntoState, type LogState } from "./state.ts";

/**
 * The whole log in v3-D09 canonical order — (ts, deviceId, deviceSeq, id).
 *
 * Read via the `by_ts` COMPOUND INDEX, so the order is a property of the store
 * rather than a sort every caller re-implements. `getAll` on an index already
 * yields index-key order.
 *
 * A defensive `sort` follows: a legacy row whose deviceId/deviceSeq/id is
 * undefined is NOT present in the compound index at all (IndexedDB skips
 * records with an undefined member of a compound keyPath), so index order
 * alone could silently omit rows. We therefore read the STORE and order in
 * memory when a mismatch is detected — correctness over cleverness.
 */
export async function getAllEvents(): Promise<LocalEventRow[]> {
  const db = await openDb();
  const indexed = await db.getAllFromIndex("events", "by_ts");
  const total = await db.count("events");
  if (indexed.length === total) return indexed;
  // Some rows are missing from the index (undefined compound member). Fall
  // back to the full store, ordered explicitly. Never drop an event.
  const all = await db.getAll("events");
  return all.sort(compareCanonical);
}

/** Events for one surah (E-01 scoping), canonically ordered. */
export async function getEventsForSurah(surah: number): Promise<LocalEventRow[]> {
  const db = await openDb();
  const rows = await db.getAllFromIndex("events", "by_surah", surah);
  return rows.sort(compareCanonical);
}

/**
 * Cursor-friendly iteration in canonical order, for folds over a log too large
 * to hold in memory. Yields one row at a time off the `by_ts` index.
 */
export async function* iterateEvents(): AsyncGenerator<LocalEventRow> {
  const db = await openDb();
  const tx = db.transaction("events", "readonly");
  let cursor = await tx.store.index("by_ts").openCursor();
  while (cursor) {
    yield cursor.value;
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function countEvents(): Promise<number> {
  const db = await openDb();
  return db.count("events");
}

/**
 * WIREFRAME §23 Q2: "record the ordinal, don't derive it."
 *
 * The NEXT ordinal for a site is `max(recorded for that site) + 1`, computed by
 * the ENGINE's own `nextVisitOrdinal` — the app never re-implements that rule.
 * The `by_siteKey` index is what makes this O(matching rows) instead of a full
 * log scan on every question served.
 */
export async function nextVisitOrdinalForSite(siteKey: string): Promise<number> {
  const db = await openDb();
  const rows = await db.getAllFromIndex("events", "by_siteKey", siteKey);
  const recorded: number[] = [];
  for (const r of rows) {
    if (typeof r.visitOrdinal === "number") recorded.push(r.visitOrdinal);
  }
  return nextVisitOrdinal(recorded);
}

/** The last-issued per-device sequence. */
export async function currentDeviceSeq(): Promise<number> {
  const db = await openDb();
  const row = await db.get("meta", "deviceSeq");
  return typeof row?.value === "number" ? row.value : 0;
}

/**
 * The whole log, as a three-state value.
 *
 * An empty store yields `empty`, NOT `ready: []`. That distinction is the
 * reason edge case #73 exists: `ready: []` invites `data.length && ...`, which
 * renders identically to pending and puts the new learner back under an
 * eternal skeleton.
 */
export async function loadLogState(): Promise<LogState<LocalEventRow[]>> {
  return readIntoState(getAllEvents, (rows) => rows.length === 0, "getAllEvents");
}

export async function loadSurahLogState(
  surah: number,
): Promise<LogState<LocalEventRow[]>> {
  return readIntoState(
    () => getEventsForSurah(surah),
    (rows) => rows.length === 0,
    `getEventsForSurah(${surah})`,
  );
}
