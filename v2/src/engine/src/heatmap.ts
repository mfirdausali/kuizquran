// Mushaf heatmap (FR9 P1). 111 ayah rows with strength bars; word bars one tap
// deeper as diagnostics only (invariant #1: the ayah is the graded unit; words
// are diagnostics). Reuses currentStrength/currentBand (already decayed to now).
// Pure; `now` passed in.

import type { AtomState, Stage } from "./atom.ts";
import type { Corpus, DrillEvent } from "./types.ts";
import { atomKey } from "./atom.ts";
import { currentStrength, currentBand } from "./strength.ts";
import { learningDayIndex, type DayConfig } from "./daybound.ts";

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

export interface GrowthPoint {
  /** Learning-day index (daybound.ts) the point falls on. */
  day: number;
  /** Total distinct ayat ENCODED (S3 whole-bank completed at least once) as of
   *  the end of this day. Monotonically non-decreasing. */
  cumulativeEncoded: number;
}

/**
 * Progress Report growth curve (v2-D17/D20): one point per learning-day that saw
 * at least one ayah newly encoded, the cumulative encoded count as of that day.
 * Each ayah counts once, at its FIRST encode (ayah_produced rung S3, or the
 * legacy rung_complete S3), structured only (invariant #5 — a free-play pass
 * never counts as encoding). Pure, no clock.
 */
export function growthCurve(events: DrillEvent[], cfg?: DayConfig): GrowthPoint[] {
  const firstEncodeTs = new Map<number, number>(); // ayah -> ts of its first encode
  for (const e of events) {
    const isEncode =
      (e.type === "ayah_produced" && e.rung === "S3") || (e.type === "rung_complete" && e.rung === "S3");
    if (!isEncode || e.structured === false) continue;
    const prior = firstEncodeTs.get(e.ayah);
    if (prior === undefined || e.ts < prior) firstEncodeTs.set(e.ayah, e.ts);
  }

  const perDay = new Map<number, number>(); // day -> # ayat first-encoded that day
  for (const ts of firstEncodeTs.values()) {
    const day = learningDayIndex(ts, cfg);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  const days = [...perDay.keys()].sort((a, b) => a - b);
  const points: GrowthPoint[] = [];
  let cumulative = 0;
  for (const day of days) {
    cumulative += perDay.get(day)!;
    points.push({ day, cumulativeEncoded: cumulative });
  }
  return points;
}
