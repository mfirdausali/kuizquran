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

import { append, type AppendContext } from "@/lib/idb/append";
import { getEventsForSurah } from "@/lib/idb/read";

/** Why a session could not start. Reported, never papered over with an empty
 *  drill — a learner staring at a blank card cannot tell "nothing due" from
 *  "the corpus failed to load", and those need different responses. */
export type SessionUnavailable =
  | "no-corpus"
  | "nothing-due";

export interface StartInput {
  surah: number;
  /** Frontend-captured clock. The engine never reaches for `Date.now()`
   *  (invariant 5); capturing it here and passing it in is this layer's job. */
  now: number;
  tz: string;
}

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
  const { queue, atoms: atomsMap, prior } = assembled;

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
      { type: "session_start", ts: now, surah, ayah: queue[0]!.ayah, rung: "RC" } as DrillEvent,
      { now, tz },
    );
  }

  const first = queue[0];
  if (!first) return { ok: false, unavailable: "nothing-due" };
  const strength = strengthOf(atomsMap, surah, first.ayah);

  return {
    ok: true,
    run: {
      surah,
      queue,
      cursor: 0,
      machine: machineFor(c, surah, first, strength),
      startedAt,
      slips: 0,
      lastTap: null,
      done: false,
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
 * Apply one tap: COMMIT, then return the state that paints a verdict.
 *
 * The append is awaited before the returned state carries `lastTap`, so the
 * card cannot reveal a verdict that no durable event supports (invariant #2).
 */
export async function answerCurrent(
  run: SessionRun,
  c: Corpus,
  optionIndex: number,
  ctx: AppendContext,
): Promise<SessionRun> {
  const cur = currentItem(run, c);
  if (!cur) return run;

  // The chosen SURFACE comes back out of the engine's own item. This module
  // never authors it, which is what keeps scripture out of application code.
  const choice = cur.options[optionIndex];
  if (choice === undefined) return run;

  const adv = advanceReconstruct(run.machine, c, choice);

  // ---- COMMIT ---------------------------------------------------------------
  await append(
    {
      type: "reconstruct_tap",
      ts: ctx.now,
      surah: run.surah,
      ayah: cur.ayah,
      rung: "RC",
      position: cur.position,
      choice,
      correct: adv.correct,
      structured: true,
    } as DrillEvent,
    ctx,
  );

  if (adv.ayahProduced) {
    await append(
      {
        type: "ayah_produced",
        ts: ctx.now,
        surah: run.surah,
        ayah: cur.ayah,
        // A fully-blanked pass encodes as S3; a partial one as S2. The ENGINE
        // decided which via `full` — this only records the verdict it returned.
        rung: adv.full ? "S3" : "S2",
        structured: true,
      } as DrillEvent,
      ctx,
    );
  }
  // ---- only now may a verdict be painted ------------------------------------

  const slips = adv.correct ? run.slips : run.slips + 1;
  const lastTap = { index: optionIndex, correct: adv.correct };

  // A wrong tap is a slip: it does NOT advance, mirroring the engine's own
  // behaviour. The learner stays on the blank until they get it.
  if (!adv.correct) {
    return { ...run, slips, lastTap };
  }

  // The ayah is finished — move to the next queue item, or end the session.
  if (adv.ayahProduced) {
    const nextCursor = run.cursor + 1;
    if (nextCursor >= run.queue.length) {
      return { ...run, machine: adv.state, cursor: nextCursor, slips, lastTap, done: true };
    }
    const events = await getEventsForSurah(run.surah);
    const atomsMap = rebuild(events);
    const nextQ = run.queue[nextCursor]!;
    return {
      ...run,
      cursor: nextCursor,
      machine: machineFor(c, run.surah, nextQ, strengthOf(atomsMap, run.surah, nextQ.ayah)),
      slips,
      lastTap,
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
