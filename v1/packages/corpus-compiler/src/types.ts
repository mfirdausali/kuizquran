// The six corpus tables emitted to public/corpus.json (PRD §9 / FR1).
// Pure data shapes — no logic. Consumed later by packages/engine.

/** POS class as reported by QAC's coarse tag: N=noun, V=verb, P=particle. */
export type WordClass = "N" | "V" | "P";

/** FR1 distractor rank order. Higher priority first. */
export type PrdRank =
  | "suffix-variant"
  | "look-alike-verse"
  | "same-root"
  | "synonym"
  | "class-neighbor";

/** The authored type carried in yusuf-mcq-items.json. */
export type SrcType = "visual" | "semantic" | "contextual" | "phonetic";

export interface Verse {
  ayah: number;
  text_uthmani: string;
  /** Mushaf page — no geometry source in v0.1. */
  page: number | null;
  /** Mushaf line — no geometry source in v0.1. */
  line: number | null;
}

export interface Gloss {
  en: string | null;
  /** MS gloss unsourced in v0.1 (columns exist per PRD i18n requirement). */
  ms: string | null;
  /** JA gloss unsourced in v0.1. */
  ja: string | null;
}

export interface Word {
  ayah: number;
  position: number;
  text_uthmani: string;
  /** QAC lemma (Arabic script); null for words QAC gives no lemma (some particles). */
  lemma: string | null;
  /** QAC triliteral root (Arabic script); null for particles / proper nouns. */
  root: string | null;
  /** QAC coarse POS; null only if the word is absent from QAC (should not happen for Yusuf). */
  class: WordClass | null;
  gloss: Gloss;
  /** Narrative act (1..19) from the mental model, for scene-anchored delivery. */
  act: number | null;
  /** Scene image cue from the mental model's act. */
  sceneImage: string | null;
}

export interface Distractor {
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

/** Connection atom: ayah n → n+1 (PRD invariant: connections are first-class). */
export interface Connection {
  from: number;
  to: number;
}

export interface WordRef {
  ayah: number;
  position: number;
}

export interface LookAlike {
  a: WordRef;
  b: WordRef;
  /** Human-readable reason (memory-hook name or "script similarity"). */
  reason: string;
  /** 0..1 normalized script similarity (1.0 for curated memory-hook pairs). */
  score: number;
}

export interface SceneBeat {
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

// ---- Raw input shapes (as inspected in kuizquran/data/) ----

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

/** Per-word morphology resolved from QAC (surah 12). */
export interface WordMorph {
  lemma: string | null;
  root: string | null;
  class: WordClass | null;
}
