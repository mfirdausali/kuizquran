// Build-plan step 16 — WIREFRAME.md §22's render contract: "four shapes,
// closed permanently." A competing design argued for two shapes and
// survived abstract inspection, but failed on live code: Test.tsx's
// reorder keeps a `reorderAttempt` accumulator and produce renders from
// ReconstructState — a STATELESS two-member union can express neither. The
// fix: put the stateful fields (`cursor`, `attempt`) INTO the render
// contract itself, not a wrapper bolted on afterward.

import type { Face } from "./faces.ts";

export type RenderShape = "choice" | "sequenceFill" | "orderTiles" | "locateChoice";

/** A small fixed option set, exactly one correct (s1/cloze/junction today). */
export interface ChoiceItem {
  shape: "choice";
  prompt: Face;
  options: Face[];
  correctIndex: number;
}

/** Blank-by-blank sequential fill (RC's own shape, and produce-from-cold).
 *  `cursor` is which blank is currently active — the stateful field
 *  Test.tsx's reconstruct-driven `produce` item needed and a stateless
 *  union couldn't carry. */
export interface SequenceFillItem {
  shape: "sequenceFill";
  ayahWords: Face[];
  blankPositions: number[];
  cursor: number;
  options: Face[];
  correctIndex: number;
}

/** Tap-to-order (reorder). `attempt` is the learner's accumulated taps so
 *  far — the stateful field a stateless union couldn't carry either. */
export interface OrderTilesItem {
  shape: "orderTiles";
  tiles: Face[];
  attempt: number[];
  correctOrder: number[];
}

/** "Which ayah is this?" — options are ayah NUMBERS, never Faces (the
 *  answer identifies a coordinate, not text). */
export interface LocateChoiceItem {
  shape: "locateChoice";
  prompt: Face;
  options: number[];
  correctIndex: number;
}

export type RenderItem = ChoiceItem | SequenceFillItem | OrderTilesItem | LocateChoiceItem;
