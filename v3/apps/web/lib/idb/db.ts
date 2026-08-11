"use client";

// The ONLY module in the app that calls indexedDB.open. Everything else goes
// through `openDb()`. (CI greps for a second call site.)

import { openDB, type IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, type Iq3Schema } from "./schema.ts";
import { classifyIdbError, withTimeout, type IdbFailure } from "./state.ts";

/**
 * Guard: IndexedDB is a browser API and does not exist in Node. But the
 * failure that actually bites is subtler (edge case #72): SSR of a
 * log-derived value produces a HYDRATION MISMATCH. The server has no log, so
 * it renders zero; the client hydrates with the real value; React sees 0 vs 4
 * and in production silently paints the wrong number — "0 ayat due" to a
 * learner who has four.
 *
 * So: a loud, specific failure at import time beats a silent zero at runtime.
 *
 * `globalThis.indexedDB` is checked rather than `window` alone because vitest
 * runs these modules under Node with fake-indexeddb installed globally — a
 * bare `typeof window === "undefined"` throw would make the store untestable
 * outside a browser, which is the opposite of what we want.
 */
function assertClientContext(): void {
  if (typeof indexedDB === "undefined") {
    throw new Error(
      "IDB module imported into a server context (no `indexedDB` global) — " +
        "see edge case #72. Corpus is server. Log is client. " +
        "Any file reaching this module must carry \"use client\".",
    );
  }
}

/** Thrown when open fails, carrying the classified reason so the caller can
 *  land straight in `broken` with the right learner-facing copy. */
export class IdbOpenError extends Error {
  constructor(
    readonly reason: IdbFailure,
    cause?: unknown,
  ) {
    super(`IndexedDB open failed: ${reason}`, { cause });
    this.name = "IdbOpenError";
  }
}

let dbPromise: Promise<IDBPDatabase<Iq3Schema>> | null = null;

/**
 * Memoized open. Concurrent callers share ONE connection and one upgrade.
 *
 * On failure the memo is CLEARED, so a later retry (the broken screen's
 * "Retry" action) genuinely re-opens rather than replaying a cached rejection
 * forever.
 */
export function openDb(): Promise<IDBPDatabase<Iq3Schema>> {
  assertClientContext();
  if (dbPromise) return dbPromise;

  const attempt = (async () => {
    try {
      const db = await withTimeout(
        openDB<Iq3Schema>(DB_NAME, DB_VERSION, {
          upgrade(database) {
            if (!database.objectStoreNames.contains("events")) {
              // keyPath "id" — the uuid. NOT `seq` (arrival order, DEFECTS#B5,
              // the exact bug) and NOT autoIncrement. Keying on the
              // idempotency key is what makes a re-append a no-op put.
              const events = database.createObjectStore("events", { keyPath: "id" });
              // v3-D09's canonical order verbatim. A compound index makes the
              // order a property of the store, so no caller re-sorts.
              events.createIndex("by_ts", ["ts", "deviceId", "deviceSeq", "id"]);
              events.createIndex("by_surah", "surah");
              events.createIndex("by_siteKey", "siteKey");
              events.createIndex("by_deviceSeq", ["deviceId", "deviceSeq"]);
            }
            if (!database.objectStoreNames.contains("meta")) {
              database.createObjectStore("meta", { keyPath: "key" });
            }
            if (!database.objectStoreNames.contains("atoms")) {
              const atoms = database.createObjectStore("atoms", { keyPath: "atomKey" });
              atoms.createIndex("by_surah", "surah");
            }
            if (!database.objectStoreNames.contains("corpus")) {
              const corpus = database.createObjectStore("corpus", { keyPath: "corpusHash" });
              corpus.createIndex("by_surah", "surah");
            }
            if (!database.objectStoreNames.contains("sessions")) {
              database.createObjectStore("sessions", { keyPath: "sessionId" });
            }
          },
          blocked() {
            // Another tab holds an older version open. Surfaced as a distinct
            // reason because its copy is "close your other tabs", not "your
            // data is gone".
          },
          terminated() {
            // The browser killed the connection (eviction, crash). Drop the
            // memo so the next call re-opens instead of using a dead handle.
            dbPromise = null;
          },
        }),
        "open",
      );

      // Opportunistic, once, on first successful open (edge case #29: Safari
      // evicting the current corpus). Never awaited in a way that can block
      // or fail the open — a browser that refuses persistence is still usable.
      void requestPersistence();
      return db;
    } catch (err) {
      dbPromise = null;
      throw new IdbOpenError(classifyIdbError(err), err);
    }
  })();

  dbPromise = attempt;
  return attempt;
}

async function requestPersistence(): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      await navigator.storage.persist();
    }
  } catch {
    // Non-fatal by construction.
  }
}

/** Test/dev seam: drop the memoized connection. Not a user-facing action. */
export function resetDbForTests(): void {
  dbPromise = null;
}
