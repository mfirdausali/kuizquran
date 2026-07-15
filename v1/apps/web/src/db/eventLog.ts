// Append-only event log backed by IndexedDB (invariant #2: events are truth;
// every tap commits locally BEFORE any UI feedback). `append` resolves only
// after the IDB transaction has durably completed — callers await it before
// animating.

import { openDB, type IDBPDatabase } from "idb";
import type { DrillEvent } from "engine";

const DB_NAME = "iman-events";
const STORE = "events";
const DB_VERSION = 2; // v2: stable `id` + `synced` flag for server sync (v0.5)

interface StoredEvent extends DrillEvent {
  seq: number;
  id: string;
  /** 0 = not yet synced to the server; 1 = acknowledged by /events. */
  synced: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion, _newVersion, tx) {
        if (!database.objectStoreNames.contains(STORE)) {
          // autoIncrement gives a durable, monotonic append sequence.
          const store = database.createObjectStore(STORE, { keyPath: "seq", autoIncrement: true });
          store.createIndex("synced", "synced");
          store.createIndex("id", "id", { unique: false });
        } else if (oldVersion < 2) {
          // v1 → v2: add sync indexes on the existing store (same upgrade txn).
          const store = tx.objectStore(STORE);
          if (!store.indexNames.contains("synced")) store.createIndex("synced", "synced");
          if (!store.indexNames.contains("id")) store.createIndex("id", "id", { unique: false });
        }
      },
      // If another tab holds the DB across a version change, don't hang forever.
      blocked() {
        /* another connection is blocking the upgrade — it will resolve when they close */
      },
      terminated() {
        dbPromise = null; // allow a reopen if the connection dies
      },
    });
  }
  return dbPromise;
}

/** Reject after `ms` so a wedged IndexedDB can never hang the whole app. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} timed out`)), ms)),
  ]);
}

function uuid(): string {
  return crypto.randomUUID();
}

/**
 * Durably append one event. Resolves ONLY after tx.done — i.e. the write is
 * committed to disk. Stamps a stable client `id` (idempotency key for sync) and
 * marks it unsynced. Returns the assigned monotonic seq.
 */
export async function append(event: DrillEvent): Promise<number> {
  const database = await db();
  const stamped: DrillEvent & { synced: number } = {
    ...event,
    id: event.id ?? uuid(),
    synced: 0,
  };
  const tx = database.transaction(STORE, "readwrite");
  const seq = (await tx.store.add(stamped)) as number;
  await tx.done; // <-- durability barrier: do not resolve until committed
  return seq;
}

/** All events in append (seq) order. Never hangs the app: on a wedged IndexedDB
 *  (open blocked by another connection/pending delete) it resolves to [] after a
 *  short timeout rather than freezing the onboarding/session gates. */
export async function getAll(): Promise<StoredEvent[]> {
  try {
    const database = await withTimeout(db(), 4000, "IndexedDB open");
    return (await withTimeout(database.getAll(STORE), 4000, "getAll")) as StoredEvent[];
  } catch {
    return [];
  }
}

/** Events not yet acknowledged by the server. */
export async function getUnsynced(): Promise<StoredEvent[]> {
  const all = await getAll();
  return all.filter((e) => e.synced !== 1);
}

/**
 * Server→client hydrate: merge events pulled from the account into the local log.
 * Idempotent by the stable client `id` — events whose id already exists locally
 * are skipped (never duplicated). Pulled events are stored `synced: 1` (they came
 * from the server) and get a fresh local `seq`. Returns how many were newly added.
 * The append-only invariant holds: we only add, never mutate or delete.
 */
export async function mergeFromServer(events: DrillEvent[]): Promise<number> {
  if (events.length === 0) return 0;
  const database = await db();
  const existing = new Set(
    ((await database.getAll(STORE)) as StoredEvent[]).map((e) => e.id),
  );
  const fresh = events.filter((e) => e.id && !existing.has(e.id));
  if (fresh.length === 0) return 0;
  const tx = database.transaction(STORE, "readwrite");
  for (const e of fresh) {
    // `seq` is the autoIncrement keyPath — omit it so IDB assigns a fresh one.
    const { seq: _drop, ...rest } = e as DrillEvent & { seq?: number };
    await tx.store.add({ ...rest, synced: 1 });
  }
  await tx.done;
  return fresh.length;
}

/** Mark the given event ids as synced (after a 2xx from /events). */
export async function markSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  const database = await db();
  const tx = database.transaction(STORE, "readwrite");
  let cursor = await tx.store.openCursor();
  while (cursor) {
    const val = cursor.value as StoredEvent;
    if (idSet.has(val.id) && val.synced !== 1) {
      await cursor.update({ ...val, synced: 1 });
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

/** Count of durably-stored events. */
export async function count(): Promise<number> {
  const database = await db();
  return database.count(STORE);
}

/**
 * Close the current handle (used by tests to simulate a process crash: the
 * next call reopens from disk). No-op if never opened.
 */
export async function _closeForTest(): Promise<void> {
  if (dbPromise) {
    const database = await dbPromise;
    database.close();
    dbPromise = null;
  }
}
