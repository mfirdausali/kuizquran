// v2-D56: the corpus every drill/test screen should actually use — the raw
// compiled corpus with the question-bank override layer already resolved in
// (gloss/distractor patches merged, disable list computed). Screens that only
// need the patched corpus (Drill/Gate) can destructure `.corpus`; Test.tsx
// also needs `.disabled` to skip disabled items.

import type { OverrideResolution } from "engine";
import { applyOverrides } from "engine";
import { loadCorpus } from "./loadCorpus.ts";
import { loadOverrides } from "../overrides/loadOverrides.ts";

export async function loadEffectiveCorpus(surah: number): Promise<OverrideResolution> {
  const [corpus, overrides] = await Promise.all([loadCorpus(surah), loadOverrides(surah)]);
  return applyOverrides(corpus, overrides);
}
