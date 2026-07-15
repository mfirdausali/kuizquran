// Mushaf heatmap (FR9 P1). 111 ayah rows with strength bars; word bars one tap
// deeper as diagnostics only (invariant #1: the ayah is the graded unit; words
// are diagnostics). Reuses currentStrength/currentBand (already decayed to now).
// Pure; `now` passed in.

import type { AtomState, Stage } from "./atom.ts";
import type { Corpus, DrillEvent } from "./types.ts";
import { atomKey } from "./atom.ts";
import { currentStrength, currentBand } from "./strength.ts";
import type { DayConfig } from "./daybound.ts";

export interface HeatmapRow {
  ayah: number;
  /** 0–100 strength decayed to now (0 if not yet encoded). */
  strength: number;
  band: Stage;
  encoded: boolean;
}

/** One row per ayah (1..ayahCount), in order. */
export function ayahHeatmap(
  corpus: Corpus,
  atoms: Map<string, AtomState>,
  now: number,
  cfg?: DayConfig,
): HeatmapRow[] {
  const rows: HeatmapRow[] = [];
  for (let ayah = 1; ayah <= corpus.meta.ayahCount; ayah++) {
    const atom = atoms.get(atomKey("ayah", ayah));
    if (!atom) {
      rows.push({ ayah, strength: 0, band: "learn", encoded: false });
    } else {
      rows.push({
        ayah,
        strength: Math.round(currentStrength(atom, now, cfg)),
        band: currentBand(atom, now, cfg),
        encoded: atom.encoded,
      });
    }
  }
  return rows;
}

export interface WordDiagnostic {
  position: number;
  text: string;
  /** Correct taps / total graded taps for this word (0..1); null if never tapped. */
  accuracy: number | null;
  taps: number;
}

/**
 * Per-word diagnostics for one ayah, from the event log — one tap deeper on the
 * heatmap. Diagnostics only (not a graded unit). Excludes pretest first-pass
 * meaning errors (invariant #3).
 */
export function wordDiagnostics(
  corpus: Corpus,
  events: DrillEvent[],
  ayah: number,
): WordDiagnostic[] {
  const words = corpus.words
    .filter((w) => w.ayah === ayah)
    .sort((a, b) => a.position - b.position);
  const byPos = new Map<number, { correct: number; total: number }>();
  for (const e of events) {
    if (e.type !== "tap" || e.ayah !== ayah || e.position === undefined) continue;
    if (e.pretest === true) continue; // pretest excluded
    if (e.correct === undefined) continue;
    const agg = byPos.get(e.position) ?? { correct: 0, total: 0 };
    agg.total += 1;
    if (e.correct) agg.correct += 1;
    byPos.set(e.position, agg);
  }
  return words.map((w) => {
    const agg = byPos.get(w.position);
    return {
      position: w.position,
      text: w.text_uthmani,
      accuracy: agg && agg.total > 0 ? agg.correct / agg.total : null,
      taps: agg?.total ?? 0,
    };
  });
}
