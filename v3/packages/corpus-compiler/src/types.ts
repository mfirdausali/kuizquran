// The six corpus tables, ported from v1/packages/corpus-compiler/src/types.ts
// (v3/CLAUDE.md's port source) with the E-01 fix: every row now carries the
// `surah` it belongs to. v1 hardcoded surah 12 everywhere and never stored it
// per-row; that is exactly the bug v3/DEFECTS.md#E-01 names — Yusuf ayah 5 and
// a second surah's ayah 5 must never collide once a second surah exists.

/** POS class as reported by QAC's coarse tag: N=noun, V=verb, P=particle. */
export type WordClass = "N" | "V" | "P";

/** FR1 distractor rank order. Higher priority first. */
export type PrdRank =
  | "suffix-variant"
  | "look-alike-verse"
  | "same-root"
  | "synonym"
  | "class-neighbor";

/** The authored type carried in yusuf-mcq-items.json. Only exists for surahs
 * with hand-authored distractor data (surah 12 at launch). */
export type SrcType = "visual" | "semantic" | "contextual" | "phonetic";

export interface Verse {
  surah: number;
  ayah: number;
  text_uthmani: string;
  /** Mushaf page — geometry merge lands in build-plan step 4. */
  page: number | null;
  /** Mushaf line — geometry merge lands in build-plan step 4. */
  line: number | null;
}

export interface Gloss {
  en: string | null;
  /** MS gloss excluded from hash v1 (v3-D15); unsourced pre-launch. */
  ms: string | null;
  /** JA gloss unsourced. */
  ja: string | null;
}

export interface Word {
  surah: number;
  ayah: number;
  position: number;
  text_uthmani: string;
  /** QAC lemma (Arabic script); null for words QAC gives no lemma (some particles). */
  lemma: string | null;
  /** QAC triliteral root (Arabic script); null for particles / proper nouns. */
  root: string | null;
  /** QAC coarse POS; null only if the word is absent from QAC. */
  class: WordClass | null;
  gloss: Gloss;
  /** Narrative act (1..N) from the surah's mental model, when one exists. */
  act: number | null;
  /** Scene image cue from the mental model's act. */
  sceneImage: string | null;
}

export interface Distractor {
  surah: number;
  ayah: number;
  position: number;
  /** 1..N authored order, preserved from the source (1 = strongest as authored). */
  rank: number;
  text: string;
  /** Best-effort mapping onto the FR1 rank taxonomy. */
  prd_rank: PrdRank;
  /** Original authored type. */
  src_type: SrcType;
  /** Original authored rationale. */
  why: string;
}

/** Connection atom: ayah n → n+1 within ONE surah (v3-D20 — chains never cross
 * a surah boundary). */
export interface Connection {
  surah: number;
  from: number;
  to: number;
}

export interface WordRef {
  ayah: number;
  position: number;
}

/** A look-alike pair is always intra-surah (cross-ayah, same surah) — one
 * `surah` field covers both refs. */
export interface LookAlike {
  surah: number;
  a: WordRef;
  b: WordRef;
  /** Human-readable reason (memory-hook name or "script similarity"). */
  reason: string;
  /** 0..1 normalized script similarity (1.0 for curated memory-hook pairs). */
  score: number;
}

export interface SceneBeat {
  surah: number;
  act: number;
  ayahRange: string;
  ayahs: number[];
  /** Author-facing placeholder per the brief. */
  label: string;
  /** The act's authored name, kept for context while labels are TODO. */
  sourceName: string;
}

export interface CorpusMeta {
  surah: number;
  ayahCount: number;
  wordCount: number;
  generatedFrom: string[];
  /** Distractor items whose self-collision was dropped during compile. */
  droppedCollisions: WordRef[];
  /** True when this surah has no authored distractor source (yusuf-mcq-items
   * style data). Distractors are empty and the compiler does not treat that
   * as a defect — foil-kernel generation (NIGHTLY.md "Distractors — decided")
   * is a separate, not-yet-implemented step. */
  distractorsAuthored: boolean;
  /** True when this surah has an authored mental model (acts / scene beats). */
  hasMentalModel: boolean;
}

export interface CorpusJson {
  meta: CorpusMeta;
  verses: Verse[];
  words: Word[];
  distractors: Distractor[];
  connections: Connection[];
  lookalikes: LookAlike[];
  sceneBeats: SceneBeat[];
}

// ---- Raw input shapes (as vendored under data/raw/<surah>-*.json) ----

export interface RawVerseWord {
  position: number;
  text_uthmani: string;
  translation: string;
}
export interface RawVerse {
  verse_number: number;
  text_uthmani: string;
  words: RawVerseWord[];
}

export interface RawDistractor {
  text: string;
  type: SrcType;
  why: string;
}
export interface RawMcqItem {
  verse: number;
  position: number;
  word: string;
  translation: string;
  clozeStem: string;
  correct: string;
  distractors: RawDistractor[];
}

export interface RawAct {
  act: number;
  name: string;
  ayahRange: string;
  summary: string;
  emotionalBeat?: string;
  sceneImage?: string;
}
export interface RawMentalModel {
  title: string;
  oneLineSpine: string;
  acts: RawAct[];
  memoryHooks: string[];
  pairingStrategy: string;
}

/** Per-word morphology resolved from QAC, for one surah. */
export interface WordMorph {
  lemma: string | null;
  root: string | null;
  class: WordClass | null;
}
