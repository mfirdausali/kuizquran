// Gloss-language persistence (v2-D27) — the learner picks EN or MS once at
// onboarding; it persists and drives every gloss-based question
// (`gloss[lang] ?? gloss.en ?? text_uthmani`, engine/src/corpus.ts wordGloss).
// Pure localStorage IO; the gloss RESOLUTION lives in the engine (invariant #6).

import type { GlossLang } from "engine";

const KEY = "iman-gloss-lang";
const DEFAULT_LANG: GlossLang = "en";

function isGlossLang(v: string | null): v is GlossLang {
  return v === "en" || v === "ms";
}

/** The learner's persisted gloss language, or the default if never set. */
export function getGlossLang(): GlossLang {
  if (typeof localStorage === "undefined") return DEFAULT_LANG;
  const v = localStorage.getItem(KEY);
  return isGlossLang(v) ? v : DEFAULT_LANG;
}

/** Persist a gloss language choice (set at onboarding; not surfaced as editable yet). */
export function setGlossLang(lang: GlossLang): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, lang);
}

export function clearGlossLang(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(KEY);
}
