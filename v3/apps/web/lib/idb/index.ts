"use client";

// The IndexedDB event-log island. Truth store for the whole app.
//
//   Corpus is server. Log is client. Skeletons are never zeros.
//
// NOT built here, deliberately: the outbox / sync / mergeFromServer. That is
// build-plan step 21, milestone M6, assigned to the sync-builder role which
// "owns B5's actual fix". `syncedAt` exists in the schema so the field is in
// place before there is data to migrate — and nothing else.

export { DB_NAME, DB_VERSION, canonicalKey, compareCanonical, toWire } from "./schema.ts";
export type {
  AtomRow,
  CorpusRow,
  Iq3Schema,
  LocalEventRow,
  MetaKey,
  MetaRow,
  SessionRow,
} from "./schema.ts";

export { openDb, resetDbForTests, IdbOpenError } from "./db.ts";

export {
  READ_TIMEOUT_MS,
  IdbTimeoutError,
  broken,
  classifyIdbError,
  empty,
  pending,
  readIntoState,
  ready,
  withTimeout,
} from "./state.ts";
export type { IdbFailure, LogState } from "./state.ts";

export {
  append,
  currentTz,
  getDeviceId,
  retryAppend,
  RetryableAppendError,
} from "./append.ts";
export type { AppendContext, AppendResult } from "./append.ts";

export {
  countEvents,
  currentDeviceSeq,
  getAllEvents,
  getEventsForSurah,
  iterateEvents,
  loadLogState,
  loadSurahLogState,
  nextVisitOrdinalForSite,
} from "./read.ts";

export { assertWriter, NotWriterError, writeLock } from "./writeLock.ts";
export type { WriterStatus } from "./writeLock.ts";

export { useLogState, useWriterStatus } from "./useLogState.ts";
