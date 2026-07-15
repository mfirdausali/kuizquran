// Scene beats: one row per narrative act (19) from yusuf-mental-model.json.
// The label is left as a TODO string for the user to author (per the brief);
// the act's source name is kept alongside for context.

import type { RawAct, SceneBeat } from "./types.ts";

/** Expand an "a-b" or "a" ayahRange string into an explicit ayah list. */
export function expandRange(range: string): number[] {
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(range.trim());
  if (m) {
    const lo = Number(m[1]);
    const hi = Number(m[2]);
    const out: number[] = [];
    for (let a = lo; a <= hi; a++) out.push(a);
    return out;
  }
  const single = Number(range.trim());
  return Number.isFinite(single) ? [single] : [];
}

export function buildSceneBeats(acts: RawAct[]): SceneBeat[] {
  return acts.map((a) => ({
    act: a.act,
    ayahRange: a.ayahRange,
    ayahs: expandRange(a.ayahRange),
    label: `TODO: author scene-beat label for act ${a.act} (${a.name})`,
    sourceName: a.name,
  }));
}

/**
 * Map ayah → act using the acts' ayah ranges, so words can be tagged with their
 * narrative act + scene image (PRD pairing strategy: anchor each word to a
 * numbered act). Returns act number and scene image per ayah.
 */
export function ayahToAct(acts: RawAct[]): Map<number, { act: number; sceneImage: string | null }> {
  const map = new Map<number, { act: number; sceneImage: string | null }>();
  for (const a of acts) {
    for (const ayah of expandRange(a.ayahRange)) {
      // First act wins if ranges ever overlap (they don't in this source).
      if (!map.has(ayah)) map.set(ayah, { act: a.act, sceneImage: a.sceneImage ?? null });
    }
  }
  return map;
}
