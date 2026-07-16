// v2-D21/D55/D56 (ROADMAP Phase 6, Appendix A §D–E) — the question-bank
// override layer's runtime resolution. `applyOverrides()` is the ONE place
// override precedence is decided (invariant #6): it takes the raw compiled
// corpus + the append-only override rows synced from Laravel and returns a
// PATCHED corpus. Every existing generator (wordGloss/distractorsFor/
// pickOptions/s1Options/ladder.nextItem/every test.ts builder/reconstruct.ts)
// keeps its exact current signature — callers just pass the patched corpus
// instead of the raw one, so "overrides win" is true everywhere at once with
// zero changes to any already-tested generator.
//
// `gloss`/`distractor`/`group` overrides are corpus-data patches, resolved
// here. `disable` is exposed as a plain list — filtering "which items to
// show" is the APP layer's concern (Test.tsx/Drill.tsx), not the engine's.
// `custom` is passed through unresolved (v2-D55): a wholly custom question
// needs new render branches in Drill/Test, real UI work no phase has needed
// yet.
//
// `group` (DATA-1, ROADMAP Phase 7) went from "stored, not wired" (v2-D55) to
// resolved: `applyOverrides` now stamps every member position of a group with
// `CorpusWord.groupPositions`, and `ladder.ts`'s S1 pass reads that to probe
// the group ONCE (at its lowest position) instead of once per token — see
// v2-D59.

import type { Corpus, CorpusDistractor, CorpusWord, GlossLang } from "./types.ts";

export type OverrideField = "gloss" | "distractor" | "group" | "disable" | "custom";

/** Mirrors the Laravel `question_overrides` row (Appendix A §D). Append-only:
 *  a correction is a NEW row with a later `createdAt`, never an edit in place. */
export interface QuestionOverride {
  id?: number;
  surah: number;
  ayah: number;
  /** null = ayah-wide (a `custom` question, or a `disable` covering every
   *  position's questions of `questionType`). */
  position: number | null;
  questionType: string;
  field: OverrideField;
  payload: unknown;
  editorId?: number | null;
  note?: string | null;
  createdAt: number;
}

export interface DisabledQuestion {
  ayah: number;
  position: number | null;
  questionType: string;
}

export interface OverrideResolution {
  /** The corpus with `gloss`/`distractor` overrides merged in — pass this to
   *  every generator instead of the raw `loadCorpus()` result. */
  corpus: Corpus;
  /** Active (latest per key, not re-enabled) `disable` overrides. */
  disabled: DisabledQuestion[];
  /** Raw `group` override rows (every row seen, for the editor's audit list —
   *  `corpus.words[].groupPositions` carries the RESOLVED latest-wins effect). */
  groups: QuestionOverride[];
  /** Raw `custom` override rows — same deferral as `groups`. */
  customs: QuestionOverride[];
}

interface GlossPayload {
  lang: GlossLang;
  text: string;
}

interface DistractorPayload {
  /** Full replacement set for this (ayah, position) — not a merge. Each entry
   *  omits `ayah`/`position` (redundant with the override row's own). */
  distractors: Omit<CorpusDistractor, "ayah" | "position">[];
}

interface DisablePayload {
  /** true (default if absent) = disabled; a later row with `false` re-enables. */
  disabled?: boolean;
}

interface GroupPayload {
  /** The OTHER position(s) grouped with the override row's own `position`
   *  (the anchor — the lowest position, the only one ever probed standalone
   *  in S1). E.g. `{position: 8, payload: {groupWith: [9]}}` for أَحَدَ+عَشَرَ. */
  groupWith: number[];
}

function isGlossPayload(p: unknown): p is GlossPayload {
  const o = p as Partial<GlossPayload> | null;
  return !!o && typeof o.text === "string" && (o.lang === "en" || o.lang === "ms");
}

function isDistractorPayload(p: unknown): p is DistractorPayload {
  const o = p as Partial<DistractorPayload> | null;
  return !!o && Array.isArray(o.distractors);
}

function isGroupPayload(p: unknown): p is GroupPayload {
  const o = p as Partial<GroupPayload> | null;
  return !!o && Array.isArray(o.groupWith) && o.groupWith.every((n) => typeof n === "number");
}

/**
 * Resolve override precedence into a patched corpus + a disabled-question
 * list. Pure and deterministic for a given (corpus, overrides) input — the
 * ONLY ordering that matters is `createdAt` (latest wins per key), never
 * array order. Overrides for a different surah than `corpus.meta.surah` are
 * ignored (defensive; callers should already filter by surah).
 */
export function applyOverrides(corpus: Corpus, overrides: QuestionOverride[]): OverrideResolution {
  const glossLatest = new Map<string, QuestionOverride>();
  const distractorLatest = new Map<string, QuestionOverride>();
  const disableLatest = new Map<string, QuestionOverride>();
  const groupLatest = new Map<string, QuestionOverride>();
  const groups: QuestionOverride[] = [];
  const customs: QuestionOverride[] = [];

  const sorted = overrides.filter((o) => o.surah === corpus.meta.surah).sort((a, b) => a.createdAt - b.createdAt);

  for (const o of sorted) {
    switch (o.field) {
      case "gloss":
        if (o.position != null && isGlossPayload(o.payload)) {
          glossLatest.set(`${o.ayah}:${o.position}:${o.payload.lang}`, o);
        }
        break;
      case "distractor":
        if (o.position != null && isDistractorPayload(o.payload)) {
          distractorLatest.set(`${o.ayah}:${o.position}`, o);
        }
        break;
      case "disable":
        disableLatest.set(`${o.ayah}:${o.position ?? "*"}:${o.questionType}`, o);
        break;
      case "group":
        groups.push(o);
        if (o.position != null && isGroupPayload(o.payload)) {
          groupLatest.set(`${o.ayah}:${o.position}`, o);
        }
        break;
      case "custom":
        customs.push(o);
        break;
    }
  }

  // DATA-1: index every group member position -> its sorted [anchor, ...rest]
  // position list, so a word gets `groupPositions` whether it's the anchor
  // (override's own `position`) or one of `groupWith`. A later override for
  // the same anchor fully REPLACES the group (not additive), matching
  // gloss/distractor's own latest-wins-per-key semantics.
  const groupPositionsByWord = new Map<string, number[]>();
  for (const ov of groupLatest.values()) {
    const payload = ov.payload as GroupPayload;
    const members = [ov.position!, ...payload.groupWith].sort((a, b) => a - b);
    for (const pos of members) {
      groupPositionsByWord.set(`${ov.ayah}:${pos}`, members);
    }
  }

  const words: CorpusWord[] = corpus.words.map((w) => {
    const patches: Partial<Record<GlossLang, string>> = {};
    for (const lang of ["en", "ms"] as GlossLang[]) {
      const ov = glossLatest.get(`${w.ayah}:${w.position}:${lang}`);
      if (ov) patches[lang] = (ov.payload as GlossPayload).text;
    }
    const groupPositions = groupPositionsByWord.get(`${w.ayah}:${w.position}`);
    if (Object.keys(patches).length === 0 && !groupPositions) return w;
    return {
      ...w,
      ...(Object.keys(patches).length > 0 ? { gloss: { ...w.gloss, ...patches } } : {}),
      ...(groupPositions ? { groupPositions } : {}),
    };
  });

  const replacedPositions = new Set(distractorLatest.keys());
  const distractors: CorpusDistractor[] = corpus.distractors.filter(
    (d) => !replacedPositions.has(`${d.ayah}:${d.position}`),
  );
  for (const ov of distractorLatest.values()) {
    const payload = ov.payload as DistractorPayload;
    for (const d of payload.distractors) {
      distractors.push({ ...d, ayah: ov.ayah, position: ov.position! });
    }
  }

  const disabled: DisabledQuestion[] = [...disableLatest.values()]
    .filter((o) => (o.payload as DisablePayload | null)?.disabled !== false)
    .map((o) => ({ ayah: o.ayah, position: o.position, questionType: o.questionType }));

  return {
    corpus: { ...corpus, words, distractors },
    disabled,
    groups,
    customs,
  };
}

/** Whether (ayah, position, questionType) is currently disabled — a
 *  position:null disable row covers every position of that questionType. */
export function isQuestionDisabled(
  disabled: DisabledQuestion[],
  ayah: number,
  position: number | null,
  questionType: string,
): boolean {
  return disabled.some(
    (d) => d.ayah === ayah && d.questionType === questionType && (d.position === null || d.position === position),
  );
}
