// Build-plan step 16 — WIREFRAME.md §22's "hard problem 2, solved at the
// type level": Quran authenticity. CorpusRef is a five-variant CLOSED
// union of pure coordinates. There is no `{ literal: string }` member —
// every answer/option slot the question compiler ever produces is a
// CorpusRef resolved by resolveRef, which can only return bytes ALREADY
// PRESENT in the compiled corpus. This is what makes hand-typed Arabic
// structurally unreachable from the compiler (INVARIANTS.md Absolute B),
// not merely a convention a future kernel could violate.

import type { Corpus, GlossLang } from "./types.ts";
import { ayahWords, distractorsFor, wordGloss } from "./corpus.ts";

export type CorpusRef =
  | { kind: "word"; ayah: number; position: number }
  | { kind: "verse"; ayah: number }
  | { kind: "gloss"; ayah: number; position: number; lang: GlossLang }
  | { kind: "distractor"; ayah: number; position: number; rank: number }
  | { kind: "ayahNumber"; ayah: number };

/**
 * The ONE function that turns a coordinate into a value. TOTAL: never
 * throws, returns `null` for any coordinate this corpus doesn't have.
 * `word`/`verse`/`gloss`/`distractor` resolve to a string (a Face's
 * eventual `text`); `ayahNumber` resolves to the number itself, only when
 * that ayah exists in this corpus.
 */
export function resolveRef(corpus: Corpus, ref: CorpusRef): string | number | null {
  switch (ref.kind) {
    case "word": {
      const w = ayahWords(corpus, ref.ayah).find((w) => w.position === ref.position);
      return w ? w.text_uthmani : null;
    }
    case "verse": {
      const v = corpus.verses.find((v) => v.ayah === ref.ayah);
      return v ? v.text_uthmani : null;
    }
    case "gloss": {
      const w = ayahWords(corpus, ref.ayah).find((w) => w.position === ref.position);
      return w ? wordGloss(w, ref.lang) : null;
    }
    case "distractor": {
      const d = distractorsFor(corpus, ref.ayah, ref.position).find((d) => d.rank === ref.rank);
      return d ? d.text : null;
    }
    case "ayahNumber": {
      return corpus.verses.some((v) => v.ayah === ref.ayah) ? ref.ayah : null;
    }
    default: {
      // Exhaustiveness: a 6th CorpusRef variant added without updating this
      // switch is a compile error here, never a silent fall-through.
      const _exhaustive: never = ref;
      return _exhaustive;
    }
  }
}
