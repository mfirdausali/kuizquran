// Scene beats: one row per narrative act, when a surah has an authored mental
// model. Ported from v1/packages/corpus-compiler/src/sceneBeats.ts,
// surah-parameterized (E-01: every row names its surah). v1's SCENE_BEAT_LABELS
// table is Yusuf-specific (act numbers 1-19) — kept as-is for surah 12; a
// surah with no mental model never calls buildSceneBeats at all (io.ts /
// buildCorpus.ts skip the whole scene-beat path when none is authored).

import type { RawAct, SceneBeat } from "./types.ts";

/** Authored one-line scene-beat labels for surah 12 (Yusuf), keyed by act
 * number (1-19). No other surah has an authored mental model yet. */
export const YUSUF_SCENE_BEAT_LABELS: Record<number, string> = {
  1: "Yaqub promises Yusuf the finest of stories is about to unfold.",
  2: "Eleven stars, the sun, and the moon bow down in Yusuf's dream.",
  3: "Envy turns brothers into plotters against their own blood.",
  4: "A false promise of play lures Yusuf from his father's side.",
  5: "Thrown into a well, then covered by a shirt stained with a lie.",
  6: "A passing caravan draws Yusuf up and sells him for a few coins.",
  7: "Bought into a noble house, raised toward wisdom and knowledge.",
  8: "Doors are barred, but Yusuf answers temptation with 'Allah forbid.'",
  9: "Both race for the door; the torn shirt at the back tells the truth.",
  10: "The city's women marvel at Yusuf and cut their hands, dazzled.",
  11: "Innocent yet imprisoned, Yusuf interprets two cellmates' dreams.",
  12: "Seven fat cows and seven lean call Yusuf's gift back into the light.",
  13: "Trusted with the treasuries, Yusuf rises to guard the land.",
  14: "Unknowing brothers return for grain; the youngest is kept behind.",
  15: "Grief whitens Yaqub's eyes again; still he chooses beautiful patience.",
  16: "'I am Yusuf, and this is my brother' — the secret is finally spoken.",
  17: "A shirt carried on the wind restores sight before it even arrives.",
  18: "The family bows together — the boyhood dream comes full circle.",
  19: "A true story, and a lesson for those who reflect.",
};

/**
 * Authored one-line scene-beat labels for surah 67 (Al-Mulk), keyed by act
 * number. HUMAN-AUTHORED CONTENT — Firdaus writes these, never an agent.
 *
 * A scene-beat label is a one-line human reading of what a passage of scripture
 * MEANS. That is interpretation, and generating it automatically would be
 * authoring religious commentary under a human's name. BUILD-PLAN puts this in
 * the same category as the Malay gloss and the qari review: human-only.
 *
 * EMPTY IS SAFE, AND IS WHY THIS SHIPS EMPTY. `buildSceneBeats` falls back to
 * `TODO: author scene-beat label for act N`, and `content-freeze.mjs` FAILS on
 * any label starting with "TODO" — so an unauthored surah cannot pass the gate
 * that guards qari booking. The gate stays closed until a human fills this in.
 *
 * Fill in alongside `data/raw/67-mental-model.json`; the act numbers must match.
 * See `v3/docs/AL-MULK-SCENE-BEATS.md`.
 */
export const MULK_SCENE_BEAT_LABELS: Record<number, string> = {
  // Act numbers here must match `acts[].act` in 67-mental-model.json.
};

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

export function buildSceneBeats(
  surah: number,
  acts: RawAct[],
  labels: Record<number, string> = {},
): SceneBeat[] {
  return acts.map((a) => ({
    surah,
    act: a.act,
    ayahRange: a.ayahRange,
    ayahs: expandRange(a.ayahRange),
    label: labels[a.act] ?? `TODO: author scene-beat label for act ${a.act} (${a.name})`,
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
