"use client";

// COMMIT BEFORE PAINT. Invariant #2's operational half.
//
//   learner taps → makeEvent() (pure constructor, no IO)
//                → append() writes to IndexedDB and AWAITS tx.done
//                → only THEN does the UI animate.
//
// The ordering is not an optimization. It is the entire reason a tab killed
// mid-session (edge case #76) loses nothing: every tap is already durable
// before the learner sees it succeed.

import type { DrillEvent } from "@engine/types.ts";
import { openDb } from "./db.ts";
import { type LocalEventRow } from "./schema.ts";
import { assertWriter } from "./writeLock.ts";
import { classifyIdbError } from "./state.ts";

/**
 * A failed append that the learner can retry.
 *
 * The critical property is `event`: the ALREADY-STAMPED row, carrying the
 * deviceSeq and id it was allocated. Retrying re-submits THAT row, so a
 * successful retry never burns a second sequence number and never creates a
 * second uuid — which would be a duplicate event under a different key.
 */
export class RetryableAppendError extends Error {
  readonly retryable = true;
  constructor(
    readonly reason: "quota-exceeded" | "write-failed",
    readonly event: LocalEventRow,
    cause?: unknown,
  ) {
    super(
      reason === "quota-exceeded"
        ? "Storage is full — this tap was NOT saved. Free up space and retry."
        : "This tap was NOT saved. Retry.",
      { cause },
    );
    this.name = "RetryableAppendError";
  }
}

/** What the caller must pass in. The frontend MAY use Date.now() and
 *  Intl...timeZone — invariant 4 forbids those INSIDE the engine; capturing
 *  them and passing them in is precisely the frontend's job. Never let the
 *  engine reach for them. */
export interface AppendContext {
  now: number;
  tz: string;
  corpusHash?: string;
}

export interface AppendResult {
  /** The row as committed, including its allocated deviceSeq/deviceId. */
  event: LocalEventRow;
  /** False when an event with this id already existed (idempotent re-append):
   *  no new deviceSeq was allocated and no duplicate row was created. */
  inserted: boolean;
}

/** Capture the device's current timezone. Frontend-only by design. */
export function currentTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ev-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/** Read (or lazily create) the stable per-device id. NEVER regenerated:
 *  regenerating forks the per-device ordinal namespace (edge cases #48/#49). */
export async function getDeviceId(): Promise<string> {
  const db = await openDb();
  const existing = await db.get("meta", "deviceId");
  if (typeof existing?.value === "string" && existing.value) return existing.value;
  const created = newUuid();
  // put-if-absent inside one tx, so two concurrent first-opens cannot mint two
  // device ids and silently fork the namespace on day one.
  const tx = db.transaction("meta", "readwrite");
  const again = await tx.store.get("deviceId");
  const settled = typeof again?.value === "string" && again.value ? again.value : created;
  if (settled === created) await tx.store.put({ key: "deviceId", value: created });
  await tx.done;
  return settled;
}

/**
 * Append one event. Durable before it returns.
 *
 * The deviceSeq read-increment-write and the event put happen in ONE
 * readwrite transaction over ["events","meta"], so a crash can never produce
 * a GAP or a DUPLICATE in the per-device sequence. Splitting them into two
 * transactions would reintroduce exactly that.
 */
export async function append(
  event: DrillEvent,
  ctx: AppendContext,
): Promise<AppendResult> {
  // 1. Writer status, re-asserted at commit time (edge case #75).
  assertWriter();

  const db = await openDb();
  const deviceId = await getDeviceId();

  // If the caller already stamped a deviceSeq (a RETRY of a previously
  // allocated row), reuse it verbatim rather than allocating a new one.
  const isRetry = typeof event.deviceSeq === "number" && typeof event.id === "string";

  let row: LocalEventRow = {
    ...event,
    id: event.id ?? newUuid(),
    ts: event.ts ?? ctx.now,
    deviceId: event.deviceId ?? deviceId,
    tz: event.tz ?? ctx.tz,
    ...(ctx.corpusHash !== undefined && event.corpusHash === undefined
      ? { corpusHash: ctx.corpusHash }
      : {}),
    syncedAt: null,
  };

  let inserted = true;

  try {
    // 2. ONE transaction over both stores.
    const tx = db.transaction(["events", "meta"], "readwrite");
    const events = tx.objectStore("events");
    const meta = tx.objectStore("meta");

    // Idempotency: the uuid is the key AND the sync idempotency key, so a
    // re-append of an already-stored id is a no-op, not a duplicate row and
    // not a burned sequence number.
    const existing = await events.get(row.id!);
    if (existing) {
      inserted = false;
      row = existing;
      await tx.done;
      return { event: row, inserted };
    }

    if (isRetry) {
      // Retry keeps its already-allocated deviceSeq. Do NOT touch the counter.
      row = { ...row, deviceSeq: event.deviceSeq };
    } else {
      // 3. Read → increment → write the counter, in this same transaction.
      const seqRow = await meta.get("deviceSeq");
      const last = typeof seqRow?.value === "number" ? seqRow.value : 0;
      const next = last + 1;
      await meta.put({ key: "deviceSeq", value: next });
      row = { ...row, deviceSeq: next };
    }

    // An index key cannot contain undefined: a row with an undefined member of
    // the by_ts compound keyPath is NOT INDEXED, and would silently vanish
    // from every canonical-order cursor. Guarantee all four are concrete.
    if (typeof row.ts !== "number") row = { ...row, ts: ctx.now };
    if (typeof row.deviceSeq !== "number") row = { ...row, deviceSeq: 0 };

    // 4. Write the event.
    await events.put(row);

    // 5. AWAIT tx.done. This is the line the whole invariant rests on.
    await tx.done;
  } catch (err) {
    const reason = classifyIdbError(err);
    // QuotaExceeded (edge case #74): the tap must NEVER be silently dropped.
    // The caller must not paint success, must not advance the cursor, and must
    // not clear the tile the learner tapped. It surfaces a RETRYABLE error
    // carrying the stamped row so retry reuses the same id and deviceSeq.
    throw new RetryableAppendError(
      reason === "quota-exceeded" ? "quota-exceeded" : "write-failed",
      row,
      err,
    );
  }

  // 6. Only now may the caller paint feedback.
  return { event: row, inserted };
}

/**
 * Retry a previously failed append. Reuses the row verbatim — same id, same
 * deviceSeq — so a success here cannot double-count.
 */
export async function retryAppend(
  failure: RetryableAppendError,
  ctx: AppendContext,
): Promise<AppendResult> {
  return append(failure.event, ctx);
}
