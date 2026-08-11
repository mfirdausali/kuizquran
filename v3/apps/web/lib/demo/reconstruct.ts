// THE INLINE DEMO'S DECISIONS — every one of them, made here.
//
// WIREFRAME §18 §2: "A fully working tap-to-reconstruct of Al-Ikhlas 112:1,
// inline, no install." §17 screen 2 is the SAME artifact: first recall,
// immediately, before any identity exists. One drill, two mount points.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS SEPARATELY FROM THE COMPONENT
// ---------------------------------------------------------------------------
// check-boundaries.mjs clause 5 forbids engine-decision logic in a view, and
// the demo is exactly where that rule is easiest to break: it is tempting to
// have the component call `initReconstruct`, compare a tap to `item.correct`,
// and decide "correct" inline. That is B2's shape (`const rung: Rung =
// item.full ? "S3" : "S2"` in a React file) rebuilt on a marketing page.
//
// So every decision lives here as a pure function over explicit state:
//
//   - WHICH ayah and WHAT band the demo runs at (`DEMO_SITE`, `DEMO_STRENGTH`);
//   - the reconstruct pass itself, from the ENGINE's own state machine;
//   - whether a tap was correct — `advanceReconstruct`'s verdict, never a
//     string comparison written here;
//   - what the surface says at each moment.
//
// The component reads fields off a returned object and puts them in elements.
//
// ---------------------------------------------------------------------------
// WHY THE DEMO IS `full: true` AND NOT THE LEARN-BAND DEFAULT
// ---------------------------------------------------------------------------
// At Learn band `blankCountFor` returns 1: the demo would blank ONE word of a
// four-word ayah and the visitor would tap once. That is not "a fully working
// tap-to-reconstruct" — it is a single tile tap, and it would undersell the
// mechanic the page exists to sell.
//
// `full: true` is the engine's OWN cold-gate construction (`gate.ts` schedules
// it; `initReconstruct(opts.full)` performs it), so the demo shows the real
// bar: every word blanked, tapped back in reading order. It is not a special
// demo mode invented here — it is the hardest rung the product actually has,
// which is the honest thing to put on a landing page.
//
// Verified against the real corpus (112 has 75 generated distractors): every
// one of 112:1's 4 words returns a FULL 4-option bank at strength 0, so no
// blank in this demo degrades to a one-option non-choice.
//
// ---------------------------------------------------------------------------
// THIS DEMO WRITES NOTHING. NOT ONE EVENT.
// ---------------------------------------------------------------------------
// It appends no event, opens no IndexedDB, mints no device id, and creates no
// atom. A visitor to the landing page has not started, and manufacturing a log
// for them would put a fabricated "first recall" into the very event stream
// that is supposed to be the truth (invariant: the log IS the record). The
// demo's whole state lives in one React `useState` and dies with the tab.
//
// That is also what keeps it honest under §18's conversion metric: the primary
// metric is "demo-qualified starts — visitors who complete the inline
// reconstruction AND tap the CTA", which is a measurement to take when
// analytics land, NOT a reason to write learner events from a marketing page.

import type { Corpus } from "@engine/types.ts";
import {
  advanceReconstruct,
  initReconstruct,
  nextReconstructItem,
  type ReconstructState,
} from "@engine/reconstruct.ts";
import { buildFace, type Face } from "@engine/faces.ts";
import type { SequenceFillItem } from "@engine/render.ts";
// The ONE shuffle. Shared with onboarding screen 2 rather than duplicated —
// see the DISPLAY ORDER note below.
import { displayOrder } from "@/lib/onboarding/pass";

/** Al-Ikhlas 112:1 — WIREFRAME §18 §2 names this exact coordinate. A
 *  COORDINATE, never text: the glyphs arrive from the corpus at runtime. */
export const DEMO_SURAH = 112;
export const DEMO_AYAH = 1;

/** Strength the demo pass initialises at. Zero is a cold, never-seen atom —
 *  which is exactly what a first-time visitor is. It also feeds `pickOptions`,
 *  so the bank is the Learn-band 4-option set (the widest, i.e. the easiest
 *  distractors), which is the right difficulty for someone who has never seen
 *  the mechanic. `full: true` supplies the blank COUNT independently. */
export const DEMO_STRENGTH = 0;

/** Why the demo cannot run. Null when it can. Each value is a DESIGNED state
 *  the surface renders — never a thrown error and never a fabricated ayah. */
export type DemoUnavailable = "no-corpus" | "no-ayah";

export interface DemoStep {
  /** The render item for the CURRENT blank — the engine's own shape. */
  item: SequenceFillItem;
  /** Faces already filled, keyed by word POSITION, for SequenceFillCard. */
  filled: ReadonlyMap<number, string>;
  /** 1-based blank number and the total, for a progress line. */
  blankNumber: number;
  blankTotal: number;
}

export interface DemoState {
  /** Engine state. Opaque to the view; only `advance` touches it. */
  readonly machine: ReconstructState;
  /** Word positions filled so far, in fill order. Deliberately positions and
   *  not text: the text is re-resolved from the corpus for painting, so this
   *  structure never becomes a second place Arabic lives. */
  readonly filledPositions: readonly number[];
  /** Slips this pass. Counted, never punished — the demo grades nothing. */
  readonly slips: number;
  /** True once every blank is filled. */
  readonly done: boolean;
  /** The index the visitor last tapped, and whether it was right. Null before
   *  the first tap and cleared as soon as the pass advances. This is what the
   *  card's `reveal` prop is built from — the view never decides it. */
  readonly lastTap: { index: number; correct: boolean } | null;
}

/** Start a demo pass, or say why it cannot start. */
export function startDemo(corpus: Corpus): { state: DemoState } | { unavailable: DemoUnavailable } {
  if (!Array.isArray(corpus.words) || corpus.words.length === 0) {
    return { unavailable: "no-corpus" };
  }
  const machine = initReconstruct(corpus, DEMO_SURAH, DEMO_AYAH, DEMO_STRENGTH, { full: true });
  // An ayah the corpus does not hold yields no words, so there is nothing to
  // reconstruct. Reported, never papered over with an empty ayah line.
  if (machine.words.length === 0 || machine.blankPositions.length === 0) {
    return { unavailable: "no-ayah" };
  }
  return {
    state: {
      machine,
      filledPositions: [],
      slips: 0,
      done: false,
      lastTap: null,
    },
  };
}

/**
 * The SequenceFillItem for the current blank, plus the already-filled map.
 *
 * Returns null once the pass is complete — there is no current blank, and
 * inventing one would put a fifth tile bank under a finished ayah.
 *
 * EVERY Face here comes from `buildFace(corpus, ref)`. That is not a style
 * choice: `buildFace` is the ONLY Face constructor and it resolves a CorpusRef
 * against the corpus, so `face.text` is bytes that were already in the corpus.
 * A Face cannot be constructed from a string this file supplies, which is what
 * makes hand-typed Arabic structurally unreachable from here.
 */
export function stepOf(state: DemoState, corpus: Corpus): DemoStep | null {
  const raw = nextReconstructItem(state.machine, corpus);
  if ("done" in raw) return null;

  // The whole ayah, always on screen (v2-D23). Positions that are blanked are
  // painted as slots by the card; it needs every word regardless.
  const ayahWords: Face[] = [];
  for (const word of state.machine.words) {
    const face = buildFace(corpus, { kind: "word", ayah: DEMO_AYAH, position: word.position });
    // A word the corpus cannot resolve is a corpus defect, not a render
    // condition to guess around. Dropping it silently would shorten the ayah
    // on screen, which is the one thing this app may never do.
    if (!face) return null;
    ayahWords.push(face);
  }

  // The option bank. `raw.options` is `[correct, ...distractors]` — surface
  // STRINGS from the engine. Each is turned back into a Face by resolving the
  // coordinate that produced it, so provenance survives the round trip: the
  // correct option is the word ref, and a distractor is the distractor ref at
  // its own rank.
  const options: Face[] = [];
  let correctIndex = -1;
  const position = raw.currentBlank;
  const correctFace = buildFace(corpus, { kind: "word", ayah: DEMO_AYAH, position });
  if (!correctFace) return null;

  for (const optionText of raw.options) {
    if (optionText === raw.correct && correctIndex === -1) {
      correctIndex = options.length;
      options.push(correctFace);
      continue;
    }
    const ref = distractorRefFor(corpus, position, optionText);
    if (!ref) return null;
    const face = buildFace(corpus, ref);
    if (!face) return null;
    options.push(face);
  }
  if (correctIndex === -1) return null;

  // DISPLAY ORDER. The engine returns `[correct, ...distractors]` — the correct
  // answer ALWAYS at index 0 — because `options.ts` states plainly that "option
  // ORDER for display is the UI's concern". Painting that order on the LANDING
  // PAGE would be the worst place in the product to get this wrong: tapping the
  // first tile every time yields a perfect reconstruction without reading a
  // single word, so the demo would "prove" a memory the visitor never used.
  // §18 calls the demo the conversion engine; a conversion engine that lies is
  // the one thing this page must not be.
  //
  // Reuses `displayOrder` from lib/onboarding/pass.ts rather than
  // re-implementing it. These two surfaces render the SAME 112:1 drill, and a
  // second copy of the shuffle is exactly how they drift — an adversarial
  // review caught precisely that drift here (this file had no shuffle at all
  // while onboarding did).
  const perm = displayOrder(options.length, position);
  const shownOptions = perm.map((i) => options[i]!);
  const shownCorrectIndex = perm.indexOf(correctIndex);

  const filled = new Map<number, string>();
  for (const filledPosition of state.filledPositions) {
    const face = buildFace(corpus, {
      kind: "word",
      ayah: DEMO_AYAH,
      position: filledPosition,
    });
    if (face) filled.set(filledPosition, face.text);
  }

  // `blankPositions` in the render contract indexes into `ayahWords`, while
  // the engine's own `blankPositions` holds corpus POSITIONS. They coincide
  // only when positions are 0-based and dense, which is not guaranteed — so
  // the mapping is made explicitly rather than assumed.
  const positionToIndex = new Map<number, number>();
  state.machine.words.forEach((w, index) => positionToIndex.set(w.position, index));
  const blankIndices: number[] = [];
  for (const blankPosition of state.machine.blankPositions) {
    const index = positionToIndex.get(blankPosition);
    if (index === undefined) return null;
    blankIndices.push(index);
  }
  const filledIndices = new Map<number, string>();
  for (const [pos, text] of filled) {
    const index = positionToIndex.get(pos);
    if (index !== undefined) filledIndices.set(index, text);
  }

  const item: SequenceFillItem = {
    shape: "sequenceFill",
    ayahWords,
    blankPositions: blankIndices,
    cursor: state.machine.blankIndex,
    options: shownOptions,
    correctIndex: shownCorrectIndex,
  };

  return {
    item,
    filled: filledIndices,
    blankNumber: raw.index,
    blankTotal: raw.total,
  };
}

/**
 * Which distractor coordinate produced this surface form.
 *
 * Needed because the engine hands back option TEXT, and a Face requires the
 * coordinate. Searching the corpus for the row whose text matches is the only
 * way back, and it is safe precisely because it can FAIL: an option text with
 * no matching corpus row returns null and the step refuses to render, rather
 * than a Face being minted from a bare string.
 */
function distractorRefFor(
  corpus: Corpus,
  position: number,
  text: string,
): { kind: "distractor"; ayah: number; position: number; rank: number } | null {
  const row = corpus.distractors.find(
    (d) => d.ayah === DEMO_AYAH && d.position === position && d.text === text,
  );
  return row ? { kind: "distractor", ayah: DEMO_AYAH, position, rank: row.rank } : null;
}

/**
 * Apply one tap.
 *
 * The verdict is `advanceReconstruct`'s, which grades by
 * `surfaceEquals(choice, item.correct)` — NFC-normalised, tatweel-stripped,
 * harakat kept distinct (B6 / v3-D12). This file never compares two Arabic
 * strings itself, and a view certainly never does.
 *
 * A wrong tap does not advance: the engine keeps the same blank, exactly as a
 * real slip does in a real session. The demo therefore cannot be completed by
 * tapping randomly until it moves on.
 */
export function applyTap(state: DemoState, corpus: Corpus, optionIndex: number): DemoState {
  if (state.done) return state;
  const step = stepOf(state, corpus);
  if (!step) return state;
  const chosen = step.item.options[optionIndex];
  if (!chosen) return state;

  const advance = advanceReconstruct(state.machine, corpus, chosen.text);
  const position = state.machine.blankPositions[state.machine.blankIndex];

  if (!advance.correct || position === undefined) {
    return {
      ...state,
      slips: state.slips + 1,
      lastTap: { index: optionIndex, correct: false },
    };
  }

  return {
    machine: advance.state,
    filledPositions: [...state.filledPositions, position],
    slips: state.slips,
    done: advance.ayahProduced === true,
    lastTap: { index: optionIndex, correct: true },
  };
}

/** Clear the reveal so the next blank starts clean. Called after the reveal
 *  has been shown; separated from `applyTap` so the timing is the view's
 *  (it is a presentation beat) while the STATE change stays here. */
export function clearReveal(state: DemoState): DemoState {
  return state.lastTap === null ? state : { ...state, lastTap: null };
}

/**
 * What the surface says right now. Computed here so two mount points (landing
 * §18, onboarding §17 screen 2) can never drift into different wording for the
 * same state, and so no sentence is assembled inside JSX.
 *
 * NOTE ON WHAT THESE STRINGS MAY NOT SAY. v3-D19: nothing here may claim to
 * teach tajwid or to replace a teacher. The completion line is deliberately
 * "you just rebuilt it from memory" — a statement about what the visitor DID —
 * and never "you have memorised it" or "you can recite it", both of which
 * §21's ladder shows would be false: tapping from a bank is cued production,
 * not free recall, and it says nothing at all about pronunciation.
 */
export function demoCaption(state: DemoState): string {
  if (state.done) {
    return state.slips === 0
      ? "You just rebuilt the ayah from memory, in order, with nothing given."
      : "You just rebuilt the ayah from memory, in order. A slip costs nothing here.";
  }
  if (state.lastTap && !state.lastTap.correct) {
    return "Not that one — try again. Nothing is graded here.";
  }
  if (state.filledPositions.length === 0) {
    return "Every word is hidden. Tap them back in reading order, right to left.";
  }
  return "Keep going — reading order, right to left.";
}
