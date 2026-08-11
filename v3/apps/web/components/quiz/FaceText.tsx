// The ONE place a Face's `script` becomes direction attributes.
//
// faces.ts: `A Face is {text, script, from}`. `script: "arabic"` must render
// dir="rtl" lang="ar" with bidi isolation; `script: "latin"` renders as normal
// LTR chrome. Every shape component funnels its Faces through here rather than
// writing `dir={...}` itself, because edge case #80 ("Arabic inside LTR rows →
// bidi reorder") is not a per-component judgement call — it is one rule, and a
// rule implemented four times is a rule that will be implemented three times
// after the next refactor.
//
// WHY `unicode-bidi: isolate` IS NOT OPTIONAL (#80). Without isolation the
// Unicode bidi algorithm resolves an RTL run against the SURROUNDING
// paragraph, so an Arabic option sitting in an LTR row can drag adjacent
// punctuation, digits, or a neighbouring option's leading characters into its
// own run and paint them in the wrong order. `dir="rtl"` alone does not
// prevent this — it sets the embedding level but still lets neighbours
// interact. The `.rtl-island` class in the EXT layer carries the isolation
// (`unicode-bidi: isolate`); the `dir`/`lang` ATTRIBUTES carry the meaning for
// assistive tech, which reads markup and not CSS. Both are required. The ext
// layer says this in its own comment: "This class is the paint; the attributes
// are the meaning."
//
// SACRED TEXT. There is no Arabic anywhere in this file. `face.text` arrives at
// runtime from the corpus, having been resolved by faces.ts#buildFace from a
// CorpusRef — the only constructor there is. This component never inspects,
// slices, normalizes or synthesises those bytes; it puts them in a text node
// and lets the font do the rest.

import type { Face } from "@engine/faces.ts";

/** True when this Face must be painted as an RTL Arabic island. The whole
 *  script→direction decision, stated once. */
export function isArabic(face: Face): boolean {
  return face.script === "arabic";
}

/**
 * Direction attributes for a Face. Returned as a props object rather than
 * spread inline at each call site so a test can assert the MAPPING itself
 * (`arabic → rtl/ar`, `latin → neither`) without rendering a component.
 *
 * A latin Face gets NO `dir` and NO `lang`: the surrounding chrome is already
 * LTR and English, and stamping `dir="ltr"` on every gloss would defeat a
 * future RTL-locale UI shell for no benefit today.
 */
export function faceDirProps(face: Face): { dir?: "rtl"; lang?: "ar" } {
  return isArabic(face) ? { dir: "rtl", lang: "ar" } : {};
}

export interface FaceTextProps {
  face: Face;
  /** Extra classes from the caller (`.tile`, `.option`, `.ayah` …). The
   *  Arabic island class is appended automatically — a caller cannot forget
   *  it, which is the point of routing every Face through this component. */
  className?: string;
  /** Render as a <span> (default) or the caller's own element. Kept to inline
   *  elements: a Face is always a run of text inside something else. */
  as?: "span" | "bdi";
}

/**
 * A Face, painted.
 *
 * The default element is `<bdi>` for Arabic — the HTML element whose entire
 * purpose is bidi isolation, giving the guarantee at the MARKUP level even if
 * a stylesheet fails to load. CSS isolation via `.rtl-island` is belt; `<bdi>`
 * is braces. Latin Faces stay a plain `<span>` so they inherit the chrome's
 * own flow with no isolation boundary to fight.
 */
export function FaceText({ face, className, as }: FaceTextProps) {
  const arabic = isArabic(face);
  const cls = [className, arabic ? "rtl-island" : null].filter(Boolean).join(" ");
  const props = {
    ...faceDirProps(face),
    ...(cls ? { className: cls } : {}),
  };

  // `as` lets a caller force a plain span (e.g. inside an element that is
  // already a bdi). Default: bdi for Arabic, span for Latin.
  const Element = as ?? (arabic ? "bdi" : "span");
  return <Element {...props}>{face.text}</Element>;
}
