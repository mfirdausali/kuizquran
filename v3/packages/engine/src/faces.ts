// Build-plan step 16 — WIREFRAME.md §22's "hard problem 2," part 2. "An
// Arabic Face is `{ text, script: 'arabic', from }` with `from` MANDATORY
// — only constructible by a kernel that actually read the corpus at that
// coordinate. Provenance is PRODUCED, not claimed." `buildFace` is the
// ONLY constructor; there is no other way to make a Face, so
// `resolveRef(corpus, face.from) === face.text` holds BY CONSTRUCTION.

import type { Corpus } from "./types.ts";
import { type CorpusRef, resolveRef } from "./corpusRef.ts";

export type FaceScript = "arabic" | "latin";

export interface Face {
  text: string;
  script: FaceScript;
  /** MANDATORY provenance — which corpus coordinate this text came from. */
  from: CorpusRef;
}

function scriptFor(kind: CorpusRef["kind"]): FaceScript | null {
  switch (kind) {
    case "word":
    case "verse":
    case "distractor":
      return "arabic";
    case "gloss":
      return "latin";
    case "ayahNumber":
      // A number, not text — no script applies; buildFace returns null.
      return null;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/**
 * The ONE Face constructor. Resolves `ref` against `corpus` and, only on a
 * successful (string) resolution, returns a Face carrying that exact text
 * — never text supplied by the caller. Returns `null` when the coordinate
 * doesn't resolve, or resolves to a number (`ayahNumber` — a Face is
 * always text).
 */
export function buildFace(corpus: Corpus, ref: CorpusRef): Face | null {
  const script = scriptFor(ref.kind);
  if (!script) return null;
  const resolved = resolveRef(corpus, ref);
  if (typeof resolved !== "string") return null;
  return { text: resolved, script, from: ref };
}
