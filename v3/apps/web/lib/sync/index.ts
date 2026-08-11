"use client";

// The sync island — build-plan step 21 (M6). Owns DEFECTS.md#B5's actual fix
// (merge.ts) and #B8's frontend half (apiFetch.ts + token.ts).
//
// Sync is BACKGROUND RECONCILIATION, never a precondition. Invariant #2 makes
// the local event log truth; this island only reconciles it with a server that
// may be absent, slow, or hostile. Nothing here may ever block a session.

export { canonicalJson, digestsMatch, eventDigest } from "./digest.ts";

export {
  clearToken,
  getIdentity,
  getToken,
  hasLiveToken,
  isTokenDead,
  markTokenDead,
  resetTokenForTests,
  setIdentity,
  setToken,
} from "./token.ts";

export {
  ANONYMOUS_PATH,
  apiFetch,
  mintAnonymous,
  mintCalls,
  MINT_COOLDOWN_MS,
  resetApiFetchForTests,
  setIdentityChangeHandler,
  SyncAuthError,
} from "./apiFetch.ts";
export type { AnonymousIdentity } from "./apiFetch.ts";

export {
  readOutboxLowWater,
  readPullCursor,
  resetPullCursor,
  writeOutboxLowWater,
} from "./cursor.ts";

export { FUTURE_TS_TOLERANCE_MS, mergeFromServer } from "./merge.ts";
export type { Divergence, MergeContext, MergeResult } from "./merge.ts";

export {
  advanceLowWaterIfProven,
  chunk,
  countPending,
  EVENT_BYTE_MAX,
  markSynced,
  OUTBOX_BATCH_MAX,
  selectPending,
  wireBytes,
} from "./outbox.ts";
export type { PendingSelection, QuarantinedEvent } from "./outbox.ts";

export {
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  backoffMs,
  PULL_PAGE_LIMIT,
  pullFromServer,
  pushOutbox,
  shouldAttemptSync,
  syncCycle,
} from "./sync.ts";
export type { CycleResult, PullResult, PushResult, SyncContext } from "./sync.ts";
