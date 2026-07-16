// Chains + junctions (FR4 Carry). A chain drill taps through a run of ayat:
//   ayah n → junction(n→n+1) → ayah n+1 → junction(n+1→n+2) → …
// Its grade updates EVERY traversed verse AND connection (FIRe credit) — one
// pass reviews many atoms. Per D17, FIRe = breadth of credit, not extra weight:
// each atom gets a normal `review` outcome through the existing update(). Pure.

import type { ChainStep, Corpus, JunctionItem } from "./types.ts";
import { ayahWords } from "./corpus.ts";
import { atomKey, type AtomState } from "./atom.ts";
import { update, type RetrievalOutcome } from "./update.ts";
import type { DayConfig } from "./daybound.ts";

/**
 * The ordered tap-through steps for a chain from `fromAyah` to `toAyah`
 * (inclusive). e.g. chainSteps(4,5) = [ayah 4, junction 4→5, ayah 5].
 */
export function chainSteps(fromAyah: number, toAyah: number): ChainStep[] {
  const steps: ChainStep[] = [];
  for (let n = fromAyah; n <= toAyah; n++) {
    steps.push({ kind: "ayah", ref: n });
    if (n < toAyah) steps.push({ kind: "junction", from: n, to: n + 1 });
  }
  return steps;
}

/**
 * A junction check for n→n+1: "which ayah opens next?" The correct answer is the
 * opening word of ayah n+1; distractors are other ayat's opening words (look-alike
 * openings), taken deterministically from the corpus.
 */
export function junctionItem(corpus: Corpus, from: number, to: number): JunctionItem {
  const correctWord = ayahWords(corpus, to)[0];
  const correct = correctWord ? correctWord.text_uthmani : "";
  // Distractor openings: the opening word of nearby OTHER ayat (not `to`).
  const distractors: string[] = [];
  const seen = new Set<string>([correct]);
  for (let delta = 1; delta <= corpus.meta.ayahCount && distractors.length < 3; delta++) {
    for (const cand of [to + delta, to - delta]) {
      if (cand === to || cand < 1 || cand > corpus.meta.ayahCount) continue;
      const w = ayahWords(corpus, cand)[0];
      if (!w) continue;
      if (seen.has(w.text_uthmani)) continue;
      seen.add(w.text_uthmani);
      distractors.push(w.text_uthmani);
      if (distractors.length === 3) break;
    }
  }
  return { from, to, correct, options: [correct, ...distractors] };
}

/** Result of one chain step: was it recalled correctly? */
export interface ChainStepResult {
  step: ChainStep;
  correct: boolean;
}

/**
 * Apply a completed chain to the atoms map, FIRe-crediting every traversed atom.
 * Each ayah step updates its `ayah:n` atom; each junction step updates its
 * `connection:n` atom (ref = the `from` ayah). All as `review` outcomes at `ts`,
 * through the SAME update() (so damping/error rules apply). Returns a new map.
 */
export function applyChain(
  atoms: Map<string, AtomState>,
  results: ChainStepResult[],
  ts: number,
  cfg?: DayConfig,
): Map<string, AtomState> {
  const next = new Map(atoms);
  for (const { step, correct } of results) {
    const key = step.kind === "ayah" ? atomKey("ayah", step.ref) : atomKey("connection", step.from);
    const atom = next.get(key);
    // v2-BUG-3 gap guard: a chain must never materialize a phantom atom. An ayah
    // step only counts if that ayah has already been ENCODED (S3 whole-bank, real
    // Learn) — crediting an un-taught ayah as "reviewed" corrupted the shared atom
    // model every persona reads. A junction step only counts if its connection has
    // already been BORN (S4 bridge). Chains credit real atoms only; this also
    // bounds a chain to ayat the learner has actually reached.
    if (!atom) continue;
    if (step.kind === "ayah" && !atom.encoded) continue;
    const outcome: RetrievalOutcome = { kind: "review", correct, ts, structured: true };
    next.set(key, update(atom, outcome, { cfg }));
  }
  return next;
}
