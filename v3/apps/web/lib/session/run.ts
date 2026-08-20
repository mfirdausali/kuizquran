// THE SESSION LOOP — the seam that was missing (v3-D67).
//
// ---------------------------------------------------------------------------
// WHAT THIS MODULE IS, AND WHY IT IS NOT A COMPONENT
// ---------------------------------------------------------------------------
// For eight build-plan steps this app could render a question and could append
// an event, and nothing joined the two: `append()` had ZERO reachable callers,
// so invariant #2's "the event log is the truth" described a log nobody wrote.
// This module is that join, and it lives in `lib/` rather than in the route for
// a reason the boundary gate enforces mechanically: `check-boundaries.mjs`
// clause 5 fails the build if `assembleQueue` (or any strength comparison, or
// any band test) appears under `app/` or `components/`. The engine decides what
// to serve; the view renders what it is handed. B2 is impossible by
// construction, not merely fixed once.
//
// So the shape here is deliberate: this file holds NO React, NO JSX and NO DOM.
// It is a plain state machine over (corpus, event log) that the route drives.
// That is also what makes it testable end-to-end without rendering anything —
// `run.test.ts` plays whole sessions through it against a real IndexedDB.
//
// ---------------------------------------------------------------------------
// COMMIT BEFORE PAINT (invariant #2)
// ---------------------------------------------------------------------------
// `answerCurrent` AWAITS `append` before it returns a state carrying `lastTap`.
// The cards never grade their own tap — they report which index was tapped and
// paint a verdict only when the caller passes one back down as `reveal`. Since
// the only way to obtain a `lastTap` is to await this function, a verdict can
// never appear on screen that no durable event supports. Reversing those two
// lines is the whole of the "animate optimistically and reconcile later" bug.
//
// ---------------------------------------------------------------------------
// NO ARABIC. NOT ONE BYTE.
// ---------------------------------------------------------------------------
// Nothing here constructs Arabic text. Options arrive from the engine's
// `nextReconstructItem`, whose Faces come from `buildFace` resolving a
// `CorpusRef` against the corpus. The one place a surface string is handled is
// the `choice` passed to `advanceReconstruct` — and that string is read back
// OUT of the engine's own item, never supplied by this module.

import type { Corpus } from "@engine/types.ts";
import type { DrillEvent } from "@engine/types.ts";
import {
  advanceReconstruct,
  initReconstruct,
  nextReconstructItem,
  type ReconstructState,
} from "@engine/reconstruct.ts";
import { rebuild } from "@engine/rebuild.ts";
import { assembleQueue, type QueueItem } from "@engine/scheduler.ts";
import { summarizeSession, type SessionSummary } from "@engine/sessionSummary.ts";
import { atomKey } from "@engine/atom.ts";
// FR9, the 2-minute floor session (v3-D108) — see `startFloorSession` below
// for why this had zero production callers until now.
import { floorQueue } from "@engine/floor.ts";
// FR6 Door 1 ("extra Learn", v3-D98) — see `extraLearnOfferFor`/`startExtraLearn`
// below for why the summary screen, not the assembled queue, is where this lives.
// FR6 Door 2 ("weak-spot gym", v3-D106) — see `weakSpotOfferFor`/`startWeakSpotDrill`.
// FR6 diminishing-returns nudge (v3-D111) — see `diminishingReturnsNudge` below
// for why this honesty line had zero production callers until it got the one
// surface where a learner can mass the same atom: the Door 2 weak-spot offer.
import {
  extraLearnGrant,
  weakSpots,
  diminishingReturns,
  type ExtraLearnGrant,
  type WeakSpot,
} from "@engine/freeplay.ts";
// Same-learning-day scoping for the diminishing-returns rep count — the SAME
// notion `update()` uses to damp massed same-day successes ×0.35 (invariant #4),
// which is exactly the cost the nudge is honest about. DEFAULT_DAY_CONFIG,
// matching the config the offer functions' own `rebuild(prior)` folds under.
import { isSameLearningDay } from "@engine/daybound.ts";
// v3-D107 — gate forgiveness ladder (v2-D08): see `demoteOfferFor`/
// `acceptGateDemote` below for why `gateForgiveness`/`demoteToLearn` were
// UNREACHABLE (not merely unwired) until this run's slip-tracking fix.
import { gateForgiveness } from "@engine/gate.ts";
// DEFECTS.md#B2 / v3-D26: gradeClassToWire() is "the ONE function" that may
// resolve a grading decision to a wire Rung — see its own header. A hardcoded
// `rung: full ? "S3" : "S2"` here would be B2's exact ternary shape reborn in
// application code, invisible to check-boundaries.mjs clause 5 (JSX-only) and
// unasserted by any test until v3-D83 added both. Every rung below is a call,
// never a literal.
import { gradeClassToWire } from "@engine/gradeClass.ts";

import {
  append,
  retryAppend,
  RetryableAppendError,
  type AppendContext,
} from "@/lib/idb/append";
import { getEventsForSurah } from "@/lib/idb/read";
// DEFECTS.md#B10 / v3-D99 — `answerCurrent`'s `optionIndex` is the DISPLAYED
// (shuffled) slot a real tap reports, never the engine's raw, unshuffled
// order. `assemblePass` is the SAME assembly `SessionIsland` renders the
// bank from — see `answerCurrent`'s own comment for the full story.
import { assemblePass } from "@/lib/onboarding/pass";

/** Why a session could not start. Reported, never papered over with an empty
 *  drill — a learner staring at a blank card cannot tell "nothing due" from
 *  "the corpus failed to load", and those need different responses. */
export type SessionUnavailable =
  | "no-corpus"
  | "nothing-due"
  // A continuous drill (`startDrillSession`) whose chosen range/page contains
  // nothing the learner has ENCODED yet — distinct from "nothing-due" (a
  // finished daily queue) and "no-corpus" (a load failure): the learner picked
  // a real stretch, but none of it is ready to drill.
  | "none-ready";

export interface StartInput {
  surah: number;
  /** Frontend-captured clock. The engine never reaches for `Date.now()`
   *  (invariant 5); capturing it here and passing it in is this layer's job. */
  now: number;
  tz: string;
}

/** Which queue a session was started from — the ordinary daily assembly, or
 *  FR9's 2-minute floor session (`startFloorSession`, below). Named once so
 *  no caller has to spell out the string. */
export type SessionMode = "full" | "floor";

/**
 * One session in flight.
 *
 * Deliberately holds POSITIONS and QUEUE COORDINATES, never Arabic text: the
 * text is re-resolved from the corpus every render, so this structure can never
 * become a second place scripture lives.
 */
export interface SessionRun {
  readonly surah: number;
  /** The assembled queue, in the engine's order. The view never reorders it. */
  readonly queue: readonly QueueItem[];
  /** Index into `queue` of the item being drilled. */
  readonly cursor: number;
  /** The engine's reconstruct state for the CURRENT queue item. */
  readonly machine: ReconstructState;
  /** ts of this session's `session_start`, so the summary can bound its window
   *  without a second source of truth. */
  readonly startedAt: number;
  /** Slips this session. Counted for the summary; never punished mid-drill. */
  readonly slips: number;
  /** The last tap and its verdict, or null before the first tap / after
   *  advancing. This is what the card's `reveal` prop is built from — and it is
   *  only ever set AFTER the append has landed. */
  readonly lastTap: { index: number; correct: boolean } | null;
  /** True once the queue is exhausted. */
  readonly done: boolean;
  /**
   * v3-D107 — true once ANY tap has slipped during the CURRENT queue item,
   * IF that item is a due cold gate. Reset to `false` whenever a new queue
   * item becomes current. A cold gate is "one pass, no partial credit" (v2's
   * `pages/Gate.tsx`, the port source): `advanceReconstruct` never advances
   * on a wrong tap, so a learner always eventually completes a gate item by
   * retrying — `adv.correct` at that final, successful tap is always `true`
   * and cannot by itself say whether an EARLIER tap in the same pass
   * slipped. This flag is that missing memory; `gate_result.correct` is
   * `!gateSlipped`, never `adv.correct`. Irrelevant (and left `false`) for
   * non-gate items, which grade S2/S3 on completion regardless of slips.
   */
  readonly gateSlipped: boolean;
  /**
   * v3-D109 — v2-D08's gate-forgiveness ladder, rescaffold rung. `true` when
   * the CURRENT queue item is a due cold gate presently doing its lighter,
   * ungraded-for-pass/fail S2 warm-up pass (`RESCAFFOLD_AFTER_FAILS` <=
   * `gateFails` < `DEMOTE_OFFER_AFTER_FAILS`) — BEFORE the real full cold
   * check begins. Mirrors v2's `pages/Gate.tsx` exactly: `stage ===
   * "rescaffold"`, and `slipped` (this file's `gateSlipped`) is only ever set
   * while `stage === "cold"`, never during the warm-up. Always `false` for a
   * non-gate item, or a gate at any other rung of the ladder.
   */
  readonly rescaffolding: boolean;
  /**
   * Step 20 — whether the events this session writes are STRUCTURED (graded)
   * or free-play. `true` for the ordinary daily assembly, the floor session,
   * and every offer-extended run (invariant #5's structured session moves
   * lifecycle). `false` only for a "victory lap" continuous drill
   * (`startDrillSession` with `structured: false`): its taps AND its
   * `ayah_produced` carry `structured:false`, so the fold's guard
   * (`update.ts:71`) leaves every drilled atom untouched — "nothing can be
   * damaged", the promise `lib/drill/preview.ts` states to the learner as a
   * consequence rather than as a boolean. Gates are never a victory lap, so
   * `gate_result` stays graded regardless (a drill never queues a gate item).
   */
  readonly structured: boolean;
}

export type StartResult =
  | { ok: true; run: SessionRun }
  | { ok: false; unavailable: SessionUnavailable };

/** What the view needs to paint one question. `correctIndex` is included so the
 *  caller can report a tap by index without the view ever grading — the view
 *  passes back the index it was tapped, and THIS module decides correctness. */
export interface CurrentItem {
  readonly item: ReturnType<typeof nextReconstructItem>;
  readonly ayah: number;
  readonly position: number;
  readonly correctIndex: number;
  readonly options: readonly string[];
}

/** Build the reconstruct machine for a queue item. Strength arrives from the
 *  fold, never from a view: `blankCountFor(strength)` is precisely the kind of
 *  decision clause 5 forbids outside the engine. */
function machineFor(c: Corpus, surah: number, q: QueueItem, strength: number): ReconstructState {
  // A gate item reconstructs the WHOLE ayah (`full`); a review blanks a subset
  // sized by strength. The engine owns that sizing — this only names which.
  const full = q.kind === "gate";
  return initReconstruct(c, surah, q.ayah, strength, { full });
}

/**
 * v3-D109 — build the reconstruct machine for a queue item AND decide the
 * gate-forgiveness rescaffold rung, together, so every caller that starts or
 * advances to a fresh item gets both right in one place. A gate item whose
 * atom sits at the "rescaffold" rung (`gateForgiveness()`,
 * `packages/engine/src/gate.ts`) gets a LIGHTER, non-full S2 warm-up machine
 * first, mirroring v2's `pages/Gate.tsx` (`stage === "rescaffold"`); every
 * other gate, and every non-gate item, is unaffected — `machineFor`'s own
 * `full = kind === "gate"` rule still decides those.
 */
function machineForItem(
  c: Corpus,
  surah: number,
  q: QueueItem,
  atomsMap: ReturnType<typeof rebuild>,
): { machine: ReconstructState; rescaffolding: boolean } {
  if (q.kind === "gate") {
    const atom = atomsMap.get(atomKey(surah, "ayah", q.ayah));
    if (atom && gateForgiveness(atom) === "rescaffold") {
      const strength = strengthOf(atomsMap, surah, q.ayah);
      return {
        machine: initReconstruct(c, surah, q.ayah, strength, { full: false }),
        rescaffolding: true,
      };
    }
  }
  return { machine: machineFor(c, surah, q, strengthOf(atomsMap, surah, q.ayah)), rescaffolding: false };
}

/**
 * What one assembly of today's queue produced, plus the fold it was produced
 * FROM. The atoms come back with the queue because every caller that wants a
 * queue also wants a strength out of the same fold, and folding twice invites
 * the two to disagree.
 */
export interface AssembledQueue {
  readonly queue: readonly QueueItem[];
  readonly atoms: ReturnType<typeof rebuild>;
  /** The log this queue was assembled from, canonically ordered. */
  readonly prior: Awaited<ReturnType<typeof getEventsForSurah>>;
}

/**
 * ASSEMBLE TODAY'S QUEUE — read-only, and the single place it happens.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS EXTRACTED RATHER THAN RE-IMPLEMENTED BY THE DASHBOARD
 * ---------------------------------------------------------------------------
 * `/home` has to state a DUE COUNT, and a due count is only honest if it is the
 * count of the very items the session will actually serve. Two assemblies —
 * one for the dashboard's number and one for the drill — is exactly the shape
 * in which they drift, and the day they disagree the dashboard is lying about
 * the product's core promise. So there is ONE assembly, and both callers take
 * it. `lib/onboarding/pass.ts` was extracted for the same reason and its header
 * makes the same argument.
 *
 * It APPENDS NOTHING. `startSession` owns the `session_start` write; a
 * dashboard that merely looked at its own queue must not fabricate a session
 * the learner never opened, which is why the write stayed on the other side of
 * this seam rather than moving into it.
 *
 * Returns `null` when the corpus cannot produce anything — the caller
 * distinguishes that from "nothing due", because a learner cannot tell a
 * missing corpus from a finished day out of one shared empty state.
 */
export async function assembleFor(
  input: { surah: number; now: number },
  c: Corpus,
): Promise<AssembledQueue | null> {
  const { surah, now } = input;

  if (!Array.isArray(c.words) || c.words.length === 0) return null;

  const prior = await getEventsForSurah(surah);
  const atomsMap = rebuild(prior);
  const atoms = [...atomsMap.values()];

  // Word counts per ayah, for the engine's Learn-cost estimate. Counting words
  // is corpus METADATA, not a scheduling decision.
  const wordCounts = new Map<number, number>();
  for (const w of c.words) {
    wordCounts.set(w.ayah, (wordCounts.get(w.ayah) ?? 0) + 1);
  }

  const lastActiveDay = prior.length > 0
    ? prior.reduce((max, e) => (e.ts > max ? e.ts : max), 0)
    : null;

  const queue = assembleQueue({
    surah,
    atoms,
    now,
    lastActiveDay,
    wordCounts,
    cfg: { learnCandidates: learnCandidatesFor(c, atomsMap) },
  });

  return { queue, atoms: atomsMap, prior };
}

/**
 * Start (or RESUME) today's session.
 *
 * Resume is not a separate code path, which is the point: the queue is derived
 * from the FOLD of the event log, so a reload re-derives whatever is still due
 * and picks up where the learner left off (edge case #93). A session held only
 * in React state dies on refresh; this one cannot, because it was never the
 * source of truth.
 *
 * `session_start` is emitted only when this is genuinely a new session — a
 * resume that re-emitted it would reset the duration origin and make every
 * reload look like a fresh sitting.
 */
export async function startSession(input: StartInput, c: Corpus): Promise<StartResult> {
  const { surah, now, tz } = input;

  const assembled = await assembleFor({ surah, now }, c);
  if (!assembled) {
    return { ok: false, unavailable: "no-corpus" };
  }
  return startFromQueue(surah, now, tz, assembled.queue, assembled.atoms, assembled.prior, c);
}

/**
 * FR9 — the 2-minute floor session
 * (`packages/engine/src/floor.ts#floorQueue`/`floorMinutes`).
 *
 * `floorQueue` was real and engine-tested (`habit.test.ts`, `e01.test.ts`)
 * since it landed but had ZERO production callers — v3-D107's own sweep found
 * it and deliberately deferred it, named exactly as "needs its own /home CTA
 * and a reduced-queue entry point into the session loop." This is that entry
 * point: the SAME `session_start`/resume discipline as `startSession` (via
 * the shared `startFromQueue` below), sourcing its queue from `floorQueue`
 * instead of `assembleQueue` — the smallest viable session, at most ~2
 * minutes, never empty once anything is due or encoded.
 *
 * Atoms are filtered to `kind === "ayah"` before reaching `floorQueue` —
 * `floorQueue`'s own review/warm-up branches do not discriminate by atom
 * kind, but a "connection" atom (n→n+1) has no reconstruct surface in v3
 * (`bridge.ts` atticked at the engine port, DEFECTS.md#E-08 — "nothing left
 * to construct a seam from"), so offering one would be an undrillable dead
 * end. Same filter, same reasoning `weakSpotOfferFor` already applies to
 * FR6 Door 2.
 */
export async function startFloorSession(input: StartInput, c: Corpus): Promise<StartResult> {
  const { surah, now, tz } = input;

  if (!Array.isArray(c.words) || c.words.length === 0) {
    return { ok: false, unavailable: "no-corpus" };
  }

  const prior = await getEventsForSurah(surah);
  const atomsMap = rebuild(prior);
  const ayahAtoms = [...atomsMap.values()].filter((a) => a.kind === "ayah");
  const items = floorQueue(ayahAtoms, now);

  // FloorItem.kind is "gate" | "review" | "warmup". QueueItemKind has no
  // "warmup" member — a warm-up is a review of an already-encoded atom, so it
  // is graded as an ordinary "review" (full-weight, structured:true) through
  // the exact same `answerCurrent`/`settleAnswer` path every other queue item
  // uses. There is no second, bespoke grading rule for it, which is what
  // keeps DEFECTS.md#B2's "gradeClassToWire is the ONE function" guarantee
  // intact — the same discipline `startWeakSpotDrill` follows for FR6 Door 2.
  const queue: QueueItem[] = items.map((i) => ({
    kind: i.kind === "warmup" ? "review" : i.kind,
    atomKey: i.atomKey,
    ayah: i.ref,
    estMin: i.estMin,
  }));

  return startFromQueue(surah, now, tz, queue, atomsMap, prior, c);
}

/** What `startDrillSession` needs beyond an ordinary start: the chosen ayat and
 *  whether this is graded or a victory lap. */
export interface DrillStartInput extends StartInput {
  /**
   * The ayat the learner's `/drill` selection resolves to (a range, or a
   * mushaf page's ayah sites) — in ANY order. This function filters them to
   * the ENCODED ones and orders them ascending, so the caller may pass the raw
   * selection without pre-filtering. SEAMS are deliberately not accepted: a
   * connection atom (n→n+1) has no reconstruct surface in v3 (`bridge.ts`
   * atticked, DEFECTS.md#E-08), the same reason the floor and weak-spot drills
   * are ayah-only — a page's terminal seam is previewed on `/drill` but is not
   * a drillable step here.
   */
  readonly ayat: readonly number[];
  /**
   * false = "victory lap": every event this session writes carries
   * `structured:false`, so the fold's guard (`update.ts:71`) leaves lifecycle
   * untouched — nothing can be damaged. true = an ordinary graded review. The
   * picker presents this to the learner as a CONSEQUENCE, never as a boolean
   * (`lib/drill/preview.ts`), and `structuredFor(mode)` is the single place the
   * mode→boolean mapping is made.
   */
  readonly structured: boolean;
}

/**
 * Step 20 — START a continuous drill over a chosen range or page.
 *
 * `/drill`'s picker (`components/drill/DrillPicker.tsx`) previewed what a drill
 * would cover but had no Start button and no handoff into the loop, so the
 * whole continuous-drill surface dead-ended one tap short of drilling anything
 * — a step marked DONE on a component no route could actually run, the exact
 * failure the build's own gates exist to prevent. This is that handoff.
 *
 * WHY IT DOES NOT REUSE `assembleQueue`: the daily assembly decides what is DUE
 * today; a drill is the learner overriding that to run a specific stretch,
 * ready-or-not-due. So the queue here is exactly the READY ayat of the
 * selection, in reading order — no scheduler, no due-date filter.
 *
 * "Ready" = ENCODED. Reconstructing an ayah never produced whole is a guess,
 * not a retrieval; grading it would damage an atom that never had a chance
 * (`lib/drill/preview.ts`'s BUG-3 gap guard). That decision is made HERE, off
 * the fold — never in the picker component, which only PREVIEWS readiness
 * (check-boundaries clause 5: the component decides nothing).
 *
 * Every item is an ordinary `review`, graded through the exact same
 * `answerCurrent`/`answerAfterTap`/`settleAnswer` path every other queue item
 * uses — there is no second grading rule, so DEFECTS.md#B2's "gradeClassToWire
 * is the ONE function" guarantee holds. The only thing the drill mode changes
 * is the `structured` flag threaded onto those events (graded vs victory lap),
 * which the shared `startFromQueue` carries onto the run.
 */
export async function startDrillSession(input: DrillStartInput, c: Corpus): Promise<StartResult> {
  const { surah, now, tz, ayat, structured } = input;

  if (!Array.isArray(c.words) || c.words.length === 0) {
    return { ok: false, unavailable: "no-corpus" };
  }

  const prior = await getEventsForSurah(surah);
  const atomsMap = rebuild(prior);

  const ready = [...new Set(ayat)]
    .filter((ayah) => atomsMap.get(atomKey(surah, "ayah", ayah))?.encoded === true)
    .sort((a, b) => a - b);

  if (ready.length === 0) {
    return { ok: false, unavailable: "none-ready" };
  }

  const queue: QueueItem[] = ready.map((ayah) => ({
    kind: "review",
    atomKey: atomKey(surah, "ayah", ayah),
    ayah,
    estMin: 0,
  }));

  return startFromQueue(surah, now, tz, queue, atomsMap, prior, c, structured);
}

/**
 * Shared by `startSession` and `startFloorSession`: given an already-built
 * queue and the fold it came from, decide RESUME-vs-NEW (never re-emitting
 * `session_start` for a session already open today) and build the initial
 * `SessionRun`. Extracted so the two entry points cannot drift on the
 * session_start/resume rule — the property `startSession`'s own header
 * documents as load-bearing for `sessionSummaryOf`'s duration origin.
 */
async function startFromQueue(
  surah: number,
  now: number,
  tz: string,
  queue: readonly QueueItem[],
  atomsMap: ReturnType<typeof rebuild>,
  prior: Awaited<ReturnType<typeof getEventsForSurah>>,
  c: Corpus,
  // Step 20 — false for a "victory lap" continuous drill; true (the default)
  // for every other entry point (the daily assembly, the floor session).
  structured = true,
): Promise<StartResult> {
  if (queue.length === 0) {
    return { ok: false, unavailable: "nothing-due" };
  }

  // A session already open today? Then this is a RESUME: reuse its origin and
  // do not emit a second session_start.
  const openStart = prior.filter((e) => e.type === "session_start").pop();
  const isResume = openStart !== undefined && sameDay(openStart.ts, now);
  const startedAt = isResume ? openStart.ts : now;

  if (!isResume) {
    await append(
      {
        type: "session_start",
        ts: now,
        surah,
        ayah: queue[0]!.ayah,
        rung: gradeClassToWire("rc"),
      } as DrillEvent,
      { now, tz },
    );
  }

  const first = queue[0];
  if (!first) return { ok: false, unavailable: "nothing-due" };
  const { machine, rescaffolding } = machineForItem(c, surah, first, atomsMap);

  return {
    ok: true,
    run: {
      surah,
      queue,
      cursor: 0,
      machine,
      startedAt,
      slips: 0,
      lastTap: null,
      done: false,
      gateSlipped: false,
      rescaffolding,
      structured,
    },
  };
}

/**
 * The question to paint right now, or null when the session is finished.
 *
 * Returns null rather than inventing an item once the queue is exhausted —
 * a fifth tile bank under a finished session is worse than an empty state.
 */
export function currentItem(run: SessionRun, c: Corpus): CurrentItem | null {
  if (run.done || run.cursor >= run.queue.length) return null;

  const raw = nextReconstructItem(run.machine, c);
  if ("done" in raw) return null;

  const options = raw.options ?? [];
  const correctIndex = options.findIndex((o) => o === raw.correct);
  if (correctIndex < 0) return null;

  return {
    item: raw,
    ayah: run.machine.ayah,
    position: raw.currentBlank,
    correctIndex,
    options,
  };
}

/**
 * Thrown by `answerCurrent` when a commit fails with a RETRYABLE storage error
 * (edge case #74: QuotaExceeded, or any other transient IndexedDB write
 * failure, on a tap write). Carries `cause` — the underlying
 * `RetryableAppendError`, whose `event` is the exact stamped row that did not
 * land — and a `resume()` continuation.
 *
 * `resume()` retries THAT ONE commit via `retryAppend` (same id, same
 * deviceSeq — see `lib/idb/append.ts`'s own header) and then carries on
 * exactly where `answerCurrent` left off: if the failing commit was the tap,
 * it goes on to the `ayah_produced` commit when one is due and settles the
 * run; if the failing commit was itself `ayah_produced` (the tap had already
 * landed), it retries only that one. A caller must NEVER recover from this by
 * calling `answerCurrent` again from scratch — that re-derives `advanceReconstruct`
 * and re-appends the tap under a FRESH id, double-counting an event that may
 * already be durable. `resume()` is the only correct retry path, which is why
 * it is the thing this error carries rather than leaving the caller to
 * reconstruct one.
 */
export class SessionCommitFailure extends Error {
  constructor(
    readonly cause: RetryableAppendError,
    private readonly resumeFn: () => Promise<SessionRun>,
  ) {
    super(cause.message);
    this.name = "SessionCommitFailure";
  }

  resume(): Promise<SessionRun> {
    return this.resumeFn();
  }
}

/**
 * Commit one event, or (on retry) reuse a previously failed attempt's
 * already-stamped row via `retryAppend` — never a fresh `append` of the same
 * logical event, which would burn a second id/deviceSeq (see
 * `SessionCommitFailure`'s own header). On success, hands off to `onSuccess`.
 * On a retryable failure, throws a `SessionCommitFailure` whose `resume()`
 * re-enters THIS SAME call with the new failure as `priorFailure` — so a
 * second, third, … failure of the identical commit is handled the same way,
 * not just the first.
 */
async function commitThenContinue(
  event: DrillEvent,
  ctx: AppendContext,
  priorFailure: RetryableAppendError | null,
  onSuccess: () => Promise<SessionRun>,
): Promise<SessionRun> {
  try {
    if (priorFailure) {
      await retryAppend(priorFailure, ctx);
    } else {
      await append(event, ctx);
    }
  } catch (err) {
    if (err instanceof RetryableAppendError) {
      throw new SessionCommitFailure(err, () =>
        commitThenContinue(event, ctx, err, onSuccess),
      );
    }
    throw err;
  }
  return onSuccess();
}

/**
 * Apply one tap: COMMIT, then return the state that paints a verdict.
 *
 * The append is awaited before the returned state carries `lastTap`, so the
 * card cannot reveal a verdict that no durable event supports (invariant #2).
 *
 * A RETRYABLE commit failure (edge case #74) throws `SessionCommitFailure`
 * rather than resolving — see that class's header for why a caller must
 * retry via `.resume()`, never by calling this function again.
 */
export async function answerCurrent(
  run: SessionRun,
  c: Corpus,
  optionIndex: number,
  ctx: AppendContext,
): Promise<SessionRun> {
  const cur = currentItem(run, c);
  if (!cur) return run;

  // DEFECTS.md#B10 / v3-D99 — `optionIndex` is the LOGICAL index a real tap
  // reports (`components/quiz/QuizCard.tsx`'s own contract: "an index into
  // the item's own options... never a verbatim index into the engine's raw
  // order"), i.e. an index into the SHUFFLED display bank `assemblePass`
  // builds — the SAME assembly `SessionIsland` renders from. `cur.options`
  // (above) is the engine's RAW, UNSHUFFLED `[correct, ...distractors]`
  // (`options.ts`: "display order is the UI's concern"); indexing THAT array
  // by a shuffled slot number was exactly the drift v3-D57/D58 already found
  // and fixed once in onboarding/the landing demo
  // (`lib/demo/reconstruct.ts#applyTap` is the correct precedent this
  // mirrors) — this module reintroduced it independently at build-plan step
  // 18, ungated by any test that drives a real tap through the actual
  // shuffle (`run.test.ts`'s own `playThrough` always submitted raw index 0,
  // and the e2e suite's one `/session` tap explicitly does not care whether
  // it is right or wrong), so it shipped silently on the ONLY graded path in
  // the product. The chosen SURFACE comes back out of the engine's own item
  // (via the Face `assemblePass` already resolved through `buildFace`) —
  // this module still never authors Arabic, which is what keeps scripture
  // out of application code.
  const assembled = assemblePass(run.machine, c);
  const choice = assembled?.item.options[optionIndex]?.text;
  if (choice === undefined) return run;

  const adv = advanceReconstruct(run.machine, c, choice);

  // `tz` is stamped explicitly (rather than left to `append()`'s `ctx.tz`
  // fallback) so a resumed retry — which may run long after this `ctx` was
  // captured — commits the SAME tz the tap actually happened under, not
  // whatever the retry click's own moment would otherwise fall back to.
  const tapEvent = {
    type: "reconstruct_tap",
    ts: ctx.now,
    tz: ctx.tz,
    surah: run.surah,
    ayah: cur.ayah,
    rung: gradeClassToWire("rc"),
    position: cur.position,
    choice,
    correct: adv.correct,
    // Step 20: `run.structured` is false ONLY for a victory-lap drill, so a
    // slip during a victory lap is recorded as evidence but the fold's guard
    // (`update.ts:71`) never lets it cost strength. `true` (== graded) for
    // every ordinary session, so nothing about the normal grading path moves.
    structured: run.structured,
  } as DrillEvent;

  // ---- COMMIT ---------------------------------------------------------------
  return commitThenContinue(tapEvent, ctx, null, () =>
    answerAfterTap(run, c, cur, adv, optionIndex, ctx),
  );
}

/** Everything that happens once the tap event has durably landed — the
 *  optional `ayah_produced` commit, then settling the returned run. Split out
 *  so a retried tap (via `SessionCommitFailure.resume()`) re-enters exactly
 *  here rather than re-running `advanceReconstruct` a second time. */
async function answerAfterTap(
  run: SessionRun,
  c: Corpus,
  cur: CurrentItem,
  adv: ReturnType<typeof advanceReconstruct>,
  optionIndex: number,
  ctx: AppendContext,
): Promise<SessionRun> {
  if (adv.ayahProduced) {
    const isGateItem = run.queue[run.cursor]?.kind === "gate";

    // v3-D109 — v2-D08's rescaffold rung: the pass that JUST completed was
    // the lighter S2 warm-up (`run.rescaffolding`), not the real cold check.
    // It commits as an ordinary graded `ayah_produced` (S2, since it was not
    // `full`) exactly like any other partial reconstruct, and does NOT
    // resolve this gate item — mirrors v2's `Gate.tsx`: `stage ===
    // "rescaffold"` commits `ayah_produced` then re-arms the SAME ayah as
    // `stage: "cold"`, never a `gate_result`. `settleRescaffoldWarmup`
    // builds that real cold-check machine in place, same cursor.
    if (isGateItem && run.rescaffolding) {
      const warmupEvent = {
        type: "ayah_produced",
        ts: ctx.now,
        tz: ctx.tz,
        surah: run.surah,
        ayah: cur.ayah,
        rung: gradeClassToWire(adv.full ? "s3_full" : "s2_partial"),
        structured: true,
      } as DrillEvent;
      return commitThenContinue(warmupEvent, ctx, null, () =>
        settleRescaffoldWarmup(run, c, cur, optionIndex),
      );
    }

    // DEFECTS.md#B10-shaped drift (v3-D101): a completed queue item's `kind`
    // (`run.queue[run.cursor]`) is read once by `machineFor` to size the
    // reconstruction (`full = q.kind === "gate"`) but was never read again
    // here. A completed day-1 cold gate item was always emitted as an
    // ordinary `ayah_produced`/S3, which `rebuild.ts` folds by calling
    // `scheduleGate()` again rather than `applyGateResult()` — the ONLY
    // place `gatePassed` is ever set true — so the gate silently re-armed
    // for the next learning-day forever and a default-pace learner could
    // never unlock a second ayah. `gate_result` is the dedicated wire event
    // `rebuild.ts`/`gate.ts` already handle correctly; this only routes a
    // completed gate item through it instead of re-deriving the outcome.
    const isGate = isGateItem;
    const ayahEvent = isGate
      ? ({
          type: "gate_result",
          ts: ctx.now,
          tz: ctx.tz,
          surah: run.surah,
          ayah: cur.ayah,
          rung: gradeClassToWire("gate"),
          // v3-D107: NEVER `adv.correct` — that is only whether the FINAL,
          // completing tap was right, and a wrong tap never advances
          // (advanceReconstruct), so it is unconditionally `true` here. A
          // cold gate is "one pass, no partial credit" (v2's Gate.tsx): any
          // slip anywhere in the pass fails the whole gate. `gateSlipped`
          // is the memory of every earlier tap in THIS pass.
          correct: !run.gateSlipped,
          structured: true,
        } as DrillEvent)
      : ({
          type: "ayah_produced",
          ts: ctx.now,
          tz: ctx.tz,
          surah: run.surah,
          ayah: cur.ayah,
          // A fully-blanked pass encodes as S3; a partial one as S2. The ENGINE
          // decided which via `full` — this only resolves that GradeClass to its
          // wire Rung via gradeClassToWire(), never a re-derived ternary (B2).
          rung: gradeClassToWire(adv.full ? "s3_full" : "s2_partial"),
          // Step 20: false ONLY for a victory-lap drill, so the completed pass
          // is evidence the fold records but never grades (nothing damaged).
          // `true` for every ordinary review — the graded path is unchanged.
          structured: run.structured,
        } as DrillEvent);

    return commitThenContinue(ayahEvent, ctx, null, () =>
      settleAnswer(run, c, cur, adv, optionIndex),
    );
  }
  // ---- only now may a verdict be painted ------------------------------------
  return settleAnswer(run, c, cur, adv, optionIndex);
}

/**
 * v3-D109 — the warm-up pass for the CURRENT gate item just completed and its
 * `ayah_produced` has landed. Transition IN PLACE — same cursor, same ayah —
 * to the real full cold check; this gate item is not resolved yet. Mirrors
 * v2's `Gate.tsx` exactly: `stage: "cold"`, `slipped` reset, a fresh `full:
 * true` machine built off the atom's CURRENT strength (the warm-up may have
 * just moved it). `adv.correct` is always `true` here — `ayahProduced` only
 * ever fires on a correctly-completing tap — so `slips` is left untouched,
 * same as `settleAnswer`'s own correct-tap branches.
 */
async function settleRescaffoldWarmup(
  run: SessionRun,
  c: Corpus,
  cur: CurrentItem,
  optionIndex: number,
): Promise<SessionRun> {
  const events = await getEventsForSurah(run.surah);
  const atomsMap = rebuild(events);
  const strength = strengthOf(atomsMap, run.surah, cur.ayah);
  return {
    ...run,
    machine: initReconstruct(c, run.surah, cur.ayah, strength, { full: true }),
    rescaffolding: false,
    gateSlipped: false,
    lastTap: { index: optionIndex, correct: true },
  };
}

/** Compute the state a caller may paint a verdict from. Every commit this tap
 *  required has already landed durably by the time this runs. */
async function settleAnswer(
  run: SessionRun,
  c: Corpus,
  cur: CurrentItem,
  adv: ReturnType<typeof advanceReconstruct>,
  optionIndex: number,
): Promise<SessionRun> {
  const slips = adv.correct ? run.slips : run.slips + 1;
  const lastTap = { index: optionIndex, correct: adv.correct };

  // A wrong tap is a slip: it does NOT advance, mirroring the engine's own
  // behaviour. The learner stays on the blank until they get it. v3-D107: if
  // the item being drilled is a due cold gate, this slip must be remembered
  // past the retry that follows — `gate_result`'s eventual `correct` reads
  // this flag, never the completing tap alone. v3-D109: a slip during the
  // gate-forgiveness ladder's RESCAFFOLD warm-up is never a gate slip — only
  // the real cold check (`!run.rescaffolding`) counts, mirroring v2's
  // `Gate.tsx`: `stage === "cold" && !correct` is the only place `slipped` is
  // ever set.
  if (!adv.correct) {
    const isColdGate = run.queue[run.cursor]?.kind === "gate" && !run.rescaffolding;
    return { ...run, slips, lastTap, gateSlipped: isColdGate ? true : run.gateSlipped };
  }

  // The ayah is finished — move to the next queue item, or end the session.
  if (adv.ayahProduced) {
    const nextCursor = run.cursor + 1;
    if (nextCursor >= run.queue.length) {
      return {
        ...run,
        machine: adv.state,
        cursor: nextCursor,
        slips,
        lastTap,
        done: true,
        rescaffolding: false,
      };
    }
    const events = await getEventsForSurah(run.surah);
    const atomsMap = rebuild(events);
    const nextQ = run.queue[nextCursor]!;
    const { machine, rescaffolding } = machineForItem(c, run.surah, nextQ, atomsMap);
    return {
      ...run,
      cursor: nextCursor,
      machine,
      rescaffolding,
      slips,
      lastTap,
      // A fresh queue item starts with a clean slate, regardless of what the
      // PREVIOUS item's gate slip state was.
      gateSlipped: false,
    };
  }

  return { ...run, machine: adv.state, slips, lastTap };
}

/** Clear the reveal so the next blank paints unmarked. */
export function clearReveal(run: SessionRun): SessionRun {
  return run.lastTap === null ? run : { ...run, lastTap: null };
}

/**
 * The summary a learner sees, computed by the ENGINE from the events this
 * session actually wrote — never from a counter the view kept on the side.
 * A tally that can disagree with the log is a tally that eventually will.
 */
export async function sessionSummaryOf(run: SessionRun): Promise<SessionSummary> {
  const all = await getEventsForSurah(run.surah);
  const mine = all.filter((e) => e.ts >= run.startedAt);
  return summarizeSession(mine);
}

/**
 * FR6 Door 1 — "extra Learn" (`packages/engine/src/freeplay.ts#extraLearnGrant`).
 *
 * `extraLearnGrant` was built and unit-tested three times over (v3-D97's own
 * sweep found it, `freeplay.test.ts`'s 17 assertions) but had ZERO production
 * callers anywhere in this app or in v2 — a learner who finished today's
 * assembled queue was simply done, with no offer of one more gate-intact,
 * cost-disclosed ayah the way FR6's own "three doors after session complete"
 * describes. This is Door 1 only: Door 2 (weak-spot gym) and Door 3 (open
 * practice) each need a real UI surface of their own (a ranked list, an
 * any-ayah picker) that does not exist and is out of scope here; Door 1 needs
 * none — it slots into the summary screen this app already has.
 *
 * Re-derives the fold the same way `assembleFor` does, AFTER the session's own
 * commits have landed (`run.done` is true by the time a caller asks) — never
 * from `run`'s own in-memory queue, which reflects what was ASSEMBLED at
 * start, not what is true now that this sitting's Learn items are encoded.
 */
export async function extraLearnOfferFor(
  run: SessionRun,
  c: Corpus,
  now: number,
): Promise<ExtraLearnGrant> {
  const prior = await getEventsForSurah(run.surah);
  const atomsMap = rebuild(prior);
  const atoms = [...atomsMap.values()];
  const wordCounts = new Map<number, number>();
  for (const w of c.words) {
    wordCounts.set(w.ayah, (wordCounts.get(w.ayah) ?? 0) + 1);
  }
  const candidates = learnCandidatesFor(c, atomsMap);
  return extraLearnGrant(atoms, run.surah, candidates, now, wordCounts);
}

/**
 * Extend a COMPLETED run with the ONE Door-1 item `extraLearnOfferFor` just
 * granted. `ayah` is passed in rather than re-derived here, so a caller always
 * acts on exactly the offer it showed on screen, never a second, possibly
 * different, re-ask. Pure — it appends no event itself; the ordinary
 * `answerCurrent`/`settleAnswer` commit path takes over the moment the
 * learner taps, identically to every other queue item (including its own
 * "queue exhausted → done" ending, so a second Door-1 offer can follow the
 * same way once this one is genuinely finished).
 */
export function startExtraLearn(run: SessionRun, c: Corpus, ayah: number): SessionRun {
  const item: QueueItem = {
    kind: "learn",
    atomKey: atomKey(run.surah, "ayah", ayah),
    ayah,
    estMin: 0,
  };
  const queue = [...run.queue, item];
  const cursor = queue.length - 1;
  // The candidate is un-encoded by extraLearnGrant's own contract (it only
  // ever offers `!encoded.has(ayah)`), so its strength is definitionally 0 —
  // the same starting point a first-ever "learn" item gets inside the normal
  // assembled queue.
  return {
    ...run,
    queue,
    cursor,
    machine: machineFor(c, run.surah, item, 0),
    lastTap: null,
    done: false,
    gateSlipped: false,
    // A "learn" item is never a gate — the rescaffold ladder does not apply.
    rescaffolding: false,
    // Extra Learn is always GRADED, never inherited: if the completed run was a
    // victory-lap drill (`structured:false`), that mode must not leak into a
    // fresh Learn the engine granted — a newly learned ayah has to encode.
    structured: true,
  };
}

/**
 * FR6 Door 2 — "weak-spot gym" (`packages/engine/src/freeplay.ts#weakSpots`).
 *
 * `weakSpots` ranks every ENCODED atom by forgetting risk and has been real
 * and unit-tested (`freeplay.test.ts`) since it landed alongside Door 1
 * (v3-D98), but had zero production callers — that entry's own header named
 * Door 2 and Door 3 explicitly out of scope: "each need[s] a real UI surface
 * of their own (a ranked list, an any-ayah picker) that does not exist." This
 * is that surface for Door 2 only; Door 3 (open practice) and the
 * cold-success-adoption offer remain unwired, named here so a future run
 * does not re-discover them as new.
 *
 * Only "ayah" atoms are offered: a "connection" atom (n→n+1) has no
 * reconstruct surface in v3 — `bridge.ts` was atticked at the engine port and
 * DEFECTS.md#E-08 records "there is nothing left to construct a seam FROM
 * today" — so offering the top-risk CONNECTION would be an undrillable dead
 * end. `weakSpots` is asked for more than one candidate so a connection
 * ranked first does not silently swallow a drillable ayah ranked second.
 *
 * Re-derives the fold AFTER this session's own commits have landed, exactly
 * like `extraLearnOfferFor` — never from `run`'s in-memory queue, which
 * reflects what was assembled at start, not what is true now.
 */
export async function weakSpotOfferFor(run: SessionRun, now: number): Promise<WeakSpot | null> {
  const prior = await getEventsForSurah(run.surah);
  const atoms = [...rebuild(prior).values()];
  const spots = weakSpots(atoms, now, 10);
  return spots.find((s) => s.kind === "ayah") ?? null;
}

/**
 * Extend a COMPLETED run with the offered weak spot as an ordinary REVIEW
 * item. `ayah` is passed in rather than re-derived, so a caller always acts
 * on exactly the spot it showed on screen, never a second, possibly
 * different, re-ask.
 *
 * Unlike Door 1 (a fresh, un-encoded ayah, definitionally strength 0), this
 * is a review of something already encoded — the engine must size the
 * reconstruction (`blankCountFor`) off the atom's REAL current strength, so
 * this re-derives it via `strengthOf`, never 0.
 *
 * `kind: "review"` (not a bespoke kind) is what makes this "full-weight
 * evidence, structured:true" per FR6's own comment on `weakSpots`: it
 * commits through the EXACT SAME `answerCurrent`/`settleAnswer`/
 * `answerAfterTap` path an ordinary scheduled review does — there is no
 * second, parallel grading rule for this door, so it can never drift from
 * DEFECTS.md#B2's "gradeClassToWire is the ONE function" guarantee.
 */
export async function startWeakSpotDrill(run: SessionRun, c: Corpus, ayah: number): Promise<SessionRun> {
  const prior = await getEventsForSurah(run.surah);
  const atomsMap = rebuild(prior);
  const item: QueueItem = {
    kind: "review",
    atomKey: atomKey(run.surah, "ayah", ayah),
    ayah,
    estMin: 0,
  };
  const queue = [...run.queue, item];
  const cursor = queue.length - 1;
  return {
    ...run,
    queue,
    cursor,
    machine: machineFor(c, run.surah, item, strengthOf(atomsMap, run.surah, ayah)),
    lastTap: null,
    done: false,
    gateSlipped: false,
    // A "review" item is never a gate — the rescaffold ladder does not apply.
    rescaffolding: false,
    // The weak-spot gym is FULL-WEIGHT evidence (FR6), always graded — never
    // inherited from a victory-lap drill's `structured:false`, which would
    // silently make the weakest-atom rehearsal count for nothing.
    structured: true,
  };
}

/**
 * FR6 — the diminishing-returns nudge (`packages/engine/src/freeplay.ts
 * #diminishingReturns`).
 *
 * `diminishingReturns` was real and unit-tested (`freeplay.test.ts`) since
 * freeplay landed, but had ZERO production callers — v3-D106's own header named
 * it out of scope alongside Door 3 and the adoption offer: "each need[s] a real
 * UI surface of their own." Its surface is the one existing place a learner can
 * mass the SAME atom in a sitting: FR6 Door 2 (`weakSpotOfferFor`, above), which
 * re-offers whichever encoded atom is riskiest, so a learner who keeps tapping
 * "Practice your weakest spot" drills the same ayah over and over.
 *
 * Past `diminishingReturns`'s own threshold, invariant #4's ×0.35 massed-success
 * damping means another same-day rep is worth about a third of a spaced one —
 * this is the honest line that says so. It never HIDES the Door 2 button (the
 * learner keeps the choice); it states the cost before the tap, the same
 * discipline every other offer here follows.
 *
 * The rep count is the fold's own same-learning-day structured `ayah_produced`
 * completions of `ayah` — the reconstruct passes the ×0.35 damping actually
 * penalizes. Free-play (`structured:false`) echoes are excluded: `rebuild.ts`
 * drops them from lifecycle (invariant #5), so counting them would nudge on
 * evidence the massing penalty never touched. Same-day is scoped with
 * `DEFAULT_DAY_CONFIG` (UTC), matching the config `weakSpotOfferFor`'s own
 * `rebuild(prior)` folds under — never the machine's ambient zone.
 *
 * Returns the engine's own string, or null below the threshold — the component
 * renders whatever it is handed and decides neither the count, the threshold nor
 * the words (invariant #6).
 */
export async function diminishingReturnsNudge(
  run: SessionRun,
  ayah: number,
  now: number,
): Promise<string | null> {
  const prior = await getEventsForSurah(run.surah);
  const sameDayReps = prior.filter(
    (e) =>
      e.type === "ayah_produced" &&
      e.ayah === ayah &&
      e.structured !== false &&
      isSameLearningDay(e.ts, now),
  ).length;
  return diminishingReturns(sameDayReps);
}

/**
 * v3-D107 — gate forgiveness ladder (v2-D08), demote half.
 *
 * v3-D109 closed the rescaffold rung this header used to describe as
 * deliberately unimplemented — see `machineForItem`/`settleRescaffoldWarmup`
 * above. What follows is the demote half only.
 *
 * `gateForgiveness()`/`demoteToLearn()` (`packages/engine/src/gate.ts`) were
 * real and unit-tested since the engine port but UNREACHABLE in production —
 * see this file's own `gateSlipped` field for why `gateFails` could never
 * exceed 0 until this run. Now that a real slip can fail a gate, this offers
 * "send this verse back to Learn" once the atom has failed
 * `DEMOTE_OFFER_AFTER_FAILS` times running — mirroring v2's `Gate.tsx`
 * `stage === "demote-offer"` exactly, tap-gated, never automatic
 * (`gateForgiveness`'s own header: "the learner must tap to accept; never
 * auto-demoted").
 *
 * Re-derives the fold fresh (never from `run`'s in-memory queue, which
 * reflects what was assembled at the START of the session, before any of
 * TODAY's own gate attempts could have changed `gateFails`) — same
 * discipline as `weakSpotOfferFor`/`extraLearnOfferFor` above.
 */
export async function demoteOfferFor(run: SessionRun): Promise<{ ayah: number } | null> {
  if (run.done) return null;
  const q = run.queue[run.cursor];
  if (!q || q.kind !== "gate") return null;
  const prior = await getEventsForSurah(run.surah);
  const atom = rebuild(prior).get(atomKey(run.surah, "ayah", q.ayah));
  if (!atom) return null;
  return gateForgiveness(atom) === "demote" ? { ayah: q.ayah } : null;
}

/**
 * Accept a demote offer: commit `gate_demote` for the CURRENT gate item, then
 * advance the queue past it exactly as a completed item would — this gate
 * item is resolved, one way or the other, the moment this event lands.
 * `ayah` is read off the run itself (never passed in and trusted), so a
 * caller can only ever demote the gate it is actually looking at.
 *
 * A no-op (returns `run` unchanged, appends nothing) when the current item is
 * not a due gate — mirrors every other `start*`/`accept*` entry point's
 * "acts on exactly what it was shown" discipline rather than trusting a
 * stale caller.
 */
export async function acceptGateDemote(
  run: SessionRun,
  c: Corpus,
  ctx: AppendContext,
): Promise<SessionRun> {
  const q = run.queue[run.cursor];
  if (!q || q.kind !== "gate") return run;

  const demoteEvent = {
    type: "gate_demote",
    ts: ctx.now,
    tz: ctx.tz,
    surah: run.surah,
    ayah: q.ayah,
    // DEFECTS.md#B2: never a literal Rung. `gate_demote` is always S3 by
    // gate.ts's own contract ("gates only ever apply to S3-encoded ayat").
    rung: gradeClassToWire("gate"),
  } as DrillEvent;

  return commitThenContinue(demoteEvent, ctx, null, () => advancePastCurrent(run, c));
}

/** Move the cursor past the current queue item without grading anything —
 *  `acceptGateDemote`'s own advance, since `gate_demote` has no `adv` to
 *  read a next machine state from (unlike `settleAnswer`'s ordinary path). */
async function advancePastCurrent(run: SessionRun, c: Corpus): Promise<SessionRun> {
  const nextCursor = run.cursor + 1;
  if (nextCursor >= run.queue.length) {
    return {
      ...run,
      cursor: nextCursor,
      lastTap: null,
      gateSlipped: false,
      rescaffolding: false,
      done: true,
    };
  }
  const events = await getEventsForSurah(run.surah);
  const atomsMap = rebuild(events);
  const nextQ = run.queue[nextCursor]!;
  const { machine, rescaffolding } = machineForItem(c, run.surah, nextQ, atomsMap);
  return {
    ...run,
    cursor: nextCursor,
    machine,
    rescaffolding,
    lastTap: null,
    gateSlipped: false,
  };
}

// --- small helpers ----------------------------------------------------------

/** Strength of an ayah's atom, or 0 when it has never been seen. */
function strengthOf(atoms: ReturnType<typeof rebuild>, surah: number, ayah: number): number {
  for (const a of atoms.values()) {
    // AtomState keys the ayah as `ref`, and only an "ayah" atom refers to one —
    // a "connection" atom's `ref` is the FROM ayah of an n→n+1 link, which is a
    // different thing entirely and must never be read as this ayah's strength.
    if (a.surah === surah && a.kind === "ayah" && a.ref === ayah) return a.strength ?? 0;
  }
  return 0;
}

/** Ayat eligible to be newly Learned, in mushaf order: those with no atom yet.
 *  Which of them is actually served — and whether any is — remains the
 *  engine's call inside `assembleQueue`. */
function learnCandidatesFor(c: Corpus, atoms: ReturnType<typeof rebuild>): number[] {
  const seen = new Set<number>();
  for (const a of atoms.values()) if (a.kind === "ayah") seen.add(a.ref);
  const all = [...new Set(c.words.map((w: { ayah: number }) => w.ayah))].sort(
    (x: number, y: number) => x - y,
  );
  return all.filter((n) => !seen.has(n));
}

/** Same LOCAL day, used only to decide resume-vs-new. Day boundaries for
 *  GRADING are the engine's `DayConfig`; this is a UI-session question. */
function sameDay(a: number, b: number): boolean {
  return Math.abs(a - b) < 12 * 60 * 60 * 1000;
}
