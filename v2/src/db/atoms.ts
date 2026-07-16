// The atoms cache — a REBUILDABLE view over the append-only event log (invariant
// #2 / PRD §9: events are truth; atoms are a cache). We never persist atoms as
// primary state; on load we rebuild them from the event log via the pure engine
// fold. An optional IndexedDB snapshot is only an optimization (not truth).

import { openDB, type IDBPDatabase } from "idb";
import { rebuild, type AtomsMap, type DayConfig, type DrillEvent } from "engine";
import { getAll } from "./eventLog.ts";

const DB_NAME = "iman-atoms";
const STORE = "snapshot";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;
function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Rebuild the atoms cache from the durable event log. This is the source of
 * truth path: read every event, fold via the engine. Pure result, deterministic.
 */
export async function rebuildAtoms(cfg?: DayConfig): Promise<AtomsMap> {
  const events = (await getAll()) as DrillEvent[];
  return rebuild(events, cfg);
}

/** Persist a snapshot of the rebuilt atoms (optimization only; not truth). */
export async function saveSnapshot(atoms: AtomsMap): Promise<void> {
  const database = await db();
  const tx = database.transaction(STORE, "readwrite");
  await tx.store.put(Array.from(atoms.entries()), "atoms");
  await tx.done;
}

/** Wipe the atoms snapshot cache. Paired with eventLog.clearAll() for the
 *  "switch account" reset (v2-D12) — the atoms cache is rebuildable, so
 *  clearing it is always safe; the next rebuildAtoms() re-derives from
 *  whatever's left in the (also-cleared) event log. */
export async function clearSnapshot(): Promise<void> {
  const database = await db();
  await database.clear(STORE);
}

export async function _closeForTest(): Promise<void> {
  if (dbPromise) {
    (await dbPromise).close();
    dbPromise = null;
  }
}
