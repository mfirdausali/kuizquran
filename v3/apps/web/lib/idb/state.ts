"use client";

// The three-state loading model (edge case #73: "true-empty vs pending vs
// IDB-broken → eternal skeletons for new users").
//
// A boolean `loading` flag conflates "we have not looked yet" with "there is
// nothing", which is exactly how a brand-new learner ends up staring at a
// skeleton forever. This is a DISCRIMINATED UNION rather than three booleans
// so that, under `strict`, a component that forgets a case is a TYPE ERROR
// rather than a runtime bug.
//
// The rule that follows from it, quoted verbatim from the M5 brief:
//
//     Corpus is server. Log is client. Skeletons are never zeros.
//
// A pending count renders as a SKELETON, never as `0`. `0` is a *fact* the app
// may only state once the log has actually been read and found empty. Painting
// "0 ayat due" to a learner who has four is a retention-honesty violation
// (§10: the numbers shown must be the numbers the scheduler uses), not merely
// a cosmetic bug.

/** Why IndexedDB is unusable. These are separated because each needs
 *  DIFFERENT learner-facing copy — "you're in private browsing" and "another
 *  tab is mid-upgrade" are not the same problem and must not share a message. */
export type IdbFailure =
  /** Another tab holds an open connection blocking a version upgrade. */
  | "open-blocked"
  /** indexedDB.open() rejected outright. */
  | "open-failed"
  /** The 5s wedge guard fired — a wedged IDB must never hang the app. */
  | "read-timeout"
  /** The disk is full; the write could not be committed. */
  | "quota-exceeded"
  /** Safari private browsing has historically refused IndexedDB entirely. */
  | "private-mode"
  /** No `indexedDB` on this platform at all. */
  | "unsupported";

/**
 * The state of anything read out of the log.
 *
 * `pending` MUST be impossible to reach permanently: every path into it either
 * resolves or times out into `broken` within READ_TIMEOUT_MS. `state.test.ts`
 * asserts that timeout actually fires.
 */
export type LogState<T> =
  /** Opening / reading. Render SKELETONS — never a number, never `0`, never "—". */
  | { status: "pending" }
  /** Opened cleanly; the log has zero rows. Render the designed ZERO-STATE.
   *  This is NOT `ready` with an empty array — the distinction is the entire
   *  reason edge case #73 exists. */
  | { status: "empty" }
  /** Opened, rows read. Render CONTENT. */
  | { status: "ready"; data: T }
  /** Open or read failed. Render the full-page HARD-FAIL screen. */
  | { status: "broken"; reason: IdbFailure };

/** Reads are wrapped in a timeout so a wedged IndexedDB can never hang the
 *  app: we resolve into `broken`, we never hang and never throw into a render. */
export const READ_TIMEOUT_MS = 5_000;

export const pending = <T,>(): LogState<T> => ({ status: "pending" });
export const empty = <T,>(): LogState<T> => ({ status: "empty" });
export const ready = <T,>(data: T): LogState<T> => ({ status: "ready", data });
export const broken = <T,>(reason: IdbFailure): LogState<T> => ({ status: "broken", reason });

/**
 * Classify a thrown value into the failure reason that carries the right copy.
 * Everything unrecognised degrades to "open-failed" rather than being
 * swallowed — an unknown cause is still a broken state the learner must see.
 */
export function classifyIdbError(err: unknown): IdbFailure {
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    if (err.name === "QuotaExceededError") return "quota-exceeded";
    if (err.name === "VersionError") return "open-blocked";
    if (err.name === "InvalidStateError") return "private-mode";
  }
  const name = (err as { name?: unknown } | null)?.name;
  if (name === "QuotaExceededError") return "quota-exceeded";
  if (name === "TimeoutError") return "read-timeout";
  if (name === "InvalidStateError") return "private-mode";
  const msg = String((err as { message?: unknown } | null)?.message ?? err ?? "");
  if (/quota/i.test(msg)) return "quota-exceeded";
  if (/timed? ?out/i.test(msg)) return "read-timeout";
  if (/private/i.test(msg)) return "private-mode";
  return "open-failed";
}

/** Sentinel thrown by `withTimeout` when the deadline passes. */
export class IdbTimeoutError extends Error {
  override readonly name = "TimeoutError";
  constructor(label: string, ms: number) {
    super(`IndexedDB ${label} exceeded ${ms}ms — treating the database as wedged.`);
  }
}

/**
 * Race a promise against the wedge deadline. The timer is ALWAYS cleared, so
 * a fast read never leaves a dangling handle keeping the process alive (which
 * would hang vitest, and in a browser would pin a timer per read).
 */
export async function withTimeout<T>(
  work: Promise<T>,
  label: string,
  ms: number = READ_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new IdbTimeoutError(label, ms)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Run a read and land it in the right state, including the empty/ready split.
 *
 * `isEmpty` is REQUIRED, not optional with a truthiness default: deciding
 * "is this empty" by truthiness is precisely how `empty` and `pending` get
 * conflated again, and `0`/`""` are legitimately non-empty *values* for some
 * selectors. Forcing the caller to say what empty means keeps the distinction
 * honest at every call site.
 */
export async function readIntoState<T>(
  read: () => Promise<T>,
  isEmpty: (value: T) => boolean,
  label = "read",
): Promise<LogState<T>> {
  try {
    const value = await withTimeout(read(), label);
    return isEmpty(value) ? empty<T>() : ready(value);
  } catch (err) {
    return broken<T>(classifyIdbError(err));
  }
}
