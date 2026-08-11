"use client";

// Web Locks single-writer (edge case #75: "two tabs, one session →
// double-committed events (B5 on one device)").
//
// Two tabs of the same origin share ONE IndexedDB. If both assemble a session
// and both append, you get two deviceSeq streams from one deviceId — which
// forks the per-device ordinal namespace. That is the precise failure
// `deviceSeq` exists to prevent (v3-D09/B5), reborn on a single device.
//
// So exactly one tab is the WRITER. The others navigate and read normally, but
// their commit path is disabled and a banner offers "Use here instead".

import { openDb } from "./db.ts";

const LOCK_NAME = "iq3:writer";

/** Fallback heartbeat cadence and staleness threshold. Refresh every 2s,
 *  consider a holder dead after 6s (three missed beats — one missed beat is a
 *  busy main thread, not a dead tab). */
const HEARTBEAT_MS = 2_000;
const HEARTBEAT_STALE_MS = 6_000;

export type WriterStatus =
  /** We hold the lock. Appends are permitted. */
  | { role: "writer" }
  /** Another tab holds it. Read-only takeover mode: full navigation and full
   *  reading, commit path disabled, banner shown. */
  | { role: "reader"; reason: "another-tab" }
  /** Still acquiring. */
  | { role: "pending" };

/** Thrown by `append()` when writer status cannot be asserted. A lock lost
 *  between render and commit MUST fail the commit loudly, never write. */
export class NotWriterError extends Error {
  readonly retryable = true;
  constructor() {
    super(
      "This tab is not the writer — the session is open in another tab. " +
        "Refusing to append: a second deviceSeq stream from one deviceId " +
        "would fork the per-device ordinal namespace (edge case #75).",
    );
    this.name = "NotWriterError";
  }
}

/** How long to let `navigator.locks` actually grant the lock before concluding
 *  another tab holds it. The grant arrives in a later task, so this must not be
 *  zero — see the comment at the fallback for the defect that caused. */
const ACQUIRE_GRACE_MS = 250;

function supportsWebLocks(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.locks?.request === "function";
}

/** Per-tab identity. Distinct from `deviceId`, which is per-DEVICE and
 *  persisted — this one is deliberately ephemeral and per-tab. */
const tabId: string = newId();

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

class WriteLock {
  private status: WriterStatus = { role: "pending" };
  private listeners = new Set<(s: WriterStatus) => void>();
  private releaseHeld: (() => void) | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private started = false;
  /** True when the fallback path is in use — the takeover banner is the safety
   *  net here, because the fallback has a genuine race window and must never
   *  be presented as equivalent to Web Locks. */
  usingFallback = false;

  get current(): WriterStatus {
    return this.status;
  }

  get isWriter(): boolean {
    return this.status.role === "writer";
  }

  subscribe(fn: (s: WriterStatus) => void): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  private set(next: WriterStatus): void {
    this.status = next;
    for (const fn of this.listeners) fn(next);
  }

  /** Acquire and HOLD for the lifetime of the tab. Idempotent. */
  async acquire(): Promise<WriterStatus> {
    if (this.started) return this.status;
    this.started = true;

    if (!supportsWebLocks()) {
      this.usingFallback = true;
      return this.acquireViaHeartbeat();
    }

    // The lock is held until `held` resolves — i.e. for the tab's lifetime.
    await new Promise<void>((resolvedAcquisition) => {
      let settled = false;
      let graceTimer: ReturnType<typeof setTimeout> | null = null;
      void navigator.locks
        .request(LOCK_NAME, { mode: "exclusive" }, () => {
          // Cancel the fallback FIRST: a granted writer must never be demoted
          // to reader by a timer that fires immediately afterwards.
          if (graceTimer !== null) clearTimeout(graceTimer);
          this.set({ role: "writer" });
          if (!settled) {
            settled = true;
            resolvedAcquisition();
          }
          return new Promise<void>((release) => {
            this.releaseHeld = () => {
              this.releaseHeld = null;
              release();
            };
          });
        })
        .catch(() => {
          if (graceTimer !== null) clearTimeout(graceTimer);
          this.set({ role: "reader", reason: "another-tab" });
          if (!settled) {
            settled = true;
            resolvedAcquisition();
          }
        });

      // If the lock is already held elsewhere our callback does not run, so we
      // must not block forever: report reader and let the queued request
      // promote us later, WITHOUT a reload.
      //
      // THIS WAS A `queueMicrotask` AND IT MADE WRITING IMPOSSIBLE.
      // `navigator.locks.request` grants the lock in a later task, never within
      // the current microtask checkpoint — so the fallback ALWAYS won the race,
      // every tab settled as `reader`, `isWriter` was never true, and
      // `assertWriter()` threw on every append. A single tab with no contention
      // was told "the session is open in another tab".
      //
      // No unit test caught it: every writeLock test uses `forceForTests` and
      // none exercises `acquire()` against a real Web Lock. It surfaced in the
      // e2e suite the day something finally tried to WRITE (v3-D67) — before
      // that, nothing in the app called `acquire()` or `append()` at all, so a
      // permanently-reader lock had no observable consequence.
      //
      // A short timer, rather than no fallback at all, keeps the original
      // intent: a tab that genuinely cannot get the lock must not hang.
      graceTimer = setTimeout(() => {
        if (!settled) {
          this.set({ role: "reader", reason: "another-tab" });
          settled = true;
          resolvedAcquisition();
        }
      }, ACQUIRE_GRACE_MS);
      if (typeof graceTimer === "object" && graceTimer && "unref" in graceTimer) {
        // Never hold a Node test process open on this timer.
        (graceTimer as { unref: () => void }).unref();
      }
    });

    return this.status;
  }

  /**
   * Fallback for platforms without navigator.locks (older Safari, some
   * WebViews): a `meta` heartbeat row. This is WEAKER — between reading the
   * row and writing our own, another tab can do the same, so a race window
   * genuinely exists. It is documented as such rather than dressed up as an
   * equivalent, and the takeover banner is what actually protects the learner.
   */
  private async acquireViaHeartbeat(): Promise<WriterStatus> {
    try {
      const db = await openDb();
      const now = Date.now();
      const holder = await db.get("meta", "writerId");
      const beat = await db.get("meta", "writerHeartbeatAt");
      const beatAt = typeof beat?.value === "number" ? beat.value : 0;
      const heldByOther = holder?.value != null && holder.value !== tabId;
      const stale = now - beatAt > HEARTBEAT_STALE_MS;

      if (heldByOther && !stale) {
        this.set({ role: "reader", reason: "another-tab" });
        return this.status;
      }

      await db.put("meta", { key: "writerId", value: tabId });
      await db.put("meta", { key: "writerHeartbeatAt", value: now });
      this.set({ role: "writer" });
      this.heartbeat = setInterval(() => void this.beat(), HEARTBEAT_MS);
      return this.status;
    } catch {
      // If we cannot even determine ownership, degrade to reader. Refusing to
      // write is always safer than forking the ordinal namespace.
      this.set({ role: "reader", reason: "another-tab" });
      return this.status;
    }
  }

  private async beat(): Promise<void> {
    if (!this.isWriter) return;
    try {
      const db = await openDb();
      await db.put("meta", { key: "writerHeartbeatAt", value: Date.now() });
    } catch {
      // A failed beat does not drop the lock; the next one may succeed.
    }
  }

  /** Release, so a queued tab is promoted without a reload ("Use here instead",
   *  or unload). */
  async release(): Promise<void> {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    if (this.usingFallback && this.isWriter) {
      try {
        const db = await openDb();
        const holder = await db.get("meta", "writerId");
        if (holder?.value === tabId) {
          await db.put("meta", { key: "writerId", value: null });
        }
      } catch {
        /* best effort */
      }
    }
    this.releaseHeld?.();
    this.started = false;
    this.set({ role: "reader", reason: "another-tab" });
  }

  /** Test seam: force writer status without a real lock. */
  forceForTests(status: WriterStatus): void {
    this.started = true;
    this.set(status);
  }

  /** Test seam: return to a pristine, un-acquired lock. Without this,
   *  `forceForTests` leaves `started = true` and a later `acquire()` returns
   *  early — silently skipping the very path a fallback test means to exercise. */
  resetForTests(): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    this.releaseHeld = null;
    this.started = false;
    this.usingFallback = false;
    this.status = { role: "pending" };
    this.listeners.clear();
  }
}

export const writeLock = new WriteLock();

/**
 * Re-assert writer status at COMMIT time, not merely at render time. A tab
 * that lost the lock while frozen (bfcache) or after a takeover must fail
 * loudly here rather than write.
 */
export function assertWriter(): void {
  if (!writeLock.isWriter) throw new NotWriterError();
}
