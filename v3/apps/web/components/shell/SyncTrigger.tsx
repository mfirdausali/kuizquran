"use client";

// SYNC TRIGGER — the missing WIRE for `lib/sync/sync.ts#syncCycle()`.
//
// Build-plan step 21 shipped `syncCycle`/`pushOutbox`/`pullFromServer` (B5's
// actual fix lives in `merge.ts`, which this reaches) fully tested, exported
// from the module's own public barrel — and never called from anywhere in a
// running app. `shouldAttemptSync()` and `backoffMs()` were built for exactly
// this file and had the same zero-caller problem. DECISIONS.md v3-D88 found
// it and flagged it for a future run rather than folding it into an already
// revenue-boundary change; this is that run.
//
// WHEN IT FIRES: mount, plus window `online` and `focus`. Not invented — this
// mirrors v2's own precedent for this exact question,
// `v2/src/sync/useBackgroundSync.ts`, which this codebase's prior generation
// already answered and nothing in v3 supersedes.
//
// #103 GOVERNS THIS FILE: "quiet 'N pending' indicator; NEVER BLOCKS A
// SESSION". This component:
//   - renders null, always;
//   - never awaits anything before its first paint (the cycle runs inside an
//     effect, which fires strictly after render);
//   - is read by nothing else — no session, drill or grading path may import
//     it or read its state, because it has none to read.
//
// `shouldAttemptSync()` is honoured as a HINT before each attempt (never a
// gate on appending — nothing here touches the append path at all), so a
// phone in airplane mode does not dial a dead network on every refocus.
//
// EVERY COMPLETED CYCLE REPORTS to `lib/sync/summary.ts` — the #110
// quarantine / #50 divergence counts `SyncStatus.tsx` was built to escalate
// and this file used to discard entirely (v3-D161). Reporting is the only
// thing this component does with a cycle's result beyond deciding whether to
// retry; nothing here reads the summary back, and nothing about #103's
// "never blocks" contract changes — `report()` is a synchronous, side-
// effect-free write to a module value, not a second network call.
//
// BACKOFF, NOT A SPIN LOOP. `pushOutbox`/`pullFromServer` never throw into
// `syncCycle` (every failure becomes a `degraded` field per-result) and
// `syncCycle` itself never throws into this component either way — but this
// effect wraps the call in try/catch anyway, because a component effect is a
// boundary this codebase does not trust blindly twice. A degraded cycle
// schedules exactly ONE retry, via the exported `backoffMs(attempt)` (full
// jitter, capped) — not a fixed interval, and not a re-arm on every render. A
// clean cycle resets the attempt counter; a run of failures backs off
// further each time, capped at `BACKOFF_MAX_MS`.

import { useEffect, useRef } from "react";
import { backoffMs, shouldAttemptSync, syncCycle } from "@/lib/sync/sync";
import { syncSummary } from "@/lib/sync/summary";

export function SyncTrigger() {
  // Refs, not state: this component never re-renders itself (it always
  // returns null), so state here would be a write nothing ever reads.
  const attemptRef = useRef(0);
  const runningRef = useRef(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearRetry = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const runCycle = async () => {
      if (!alive) return;
      // `online`/`focus` can fire close together (or right after mount's own
      // attempt is still in flight). Two overlapping cycles would not corrupt
      // anything — uuid is the idempotency key — but they would double the
      // outbound traffic for no benefit. One in flight is enough; the event
      // that lost the race is redundant with the one already running.
      if (runningRef.current) return;
      // A hint, not a gate on appending — see this file's header. Skipping
      // here only means "don't dial a network we already know is dead"; the
      // local log is unaffected either way.
      if (!shouldAttemptSync()) return;

      runningRef.current = true;
      let degraded = false;
      try {
        const result = await syncCycle({ now: Date.now() });
        syncSummary.report(result);
        degraded = Boolean(result.push?.degraded || result.pull?.degraded);
      } catch {
        // syncCycle is documented to never throw into its caller. Caught
        // anyway: an effect boundary in this codebase does not trust that
        // twice, and an unhandled rejection here would surface in the
        // console on every learner's device for a background feature nobody
        // asked to look at.
        degraded = true;
      }
      runningRef.current = false;
      if (!alive) return;

      if (degraded) {
        const attempt = attemptRef.current;
        attemptRef.current = attempt + 1;
        clearRetry();
        timer = setTimeout(() => {
          void runCycle();
        }, backoffMs(attempt));
      } else {
        attemptRef.current = 0;
      }
    };

    void runCycle();

    const onEvent = () => {
      // A fresh trigger supersedes any pending backoff — the network or the
      // tab is provably alive right now, so waiting out a stale jittered
      // delay would only slow down a reconnect the browser just told us
      // about.
      clearRetry();
      void runCycle();
    };
    window.addEventListener("online", onEvent);
    window.addEventListener("focus", onEvent);

    return () => {
      alive = false;
      clearRetry();
      window.removeEventListener("online", onEvent);
      window.removeEventListener("focus", onEvent);
    };
  }, []);

  return null;
}
