"use client";

// The IndexedDB event-log island. Truth store for the whole app.
//
//   Corpus is server. Log is client. Skeletons are never zeros.
//
// NOT built here, deliberately: the outbox / sync / mergeFromServer. Those
// shipped in build-plan step 21 (M6) and live in `lib/sync/`, which owns B5's
// actual fix and B8's frontend half. They are a SEPARATE island that builds on
// this one — this module stays the truth store and knows nothing about the
// network. `syncedAt` is defined here (it is a property of a stored row) and is
// interpreted there (`syncedAt == null` means pending).

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
