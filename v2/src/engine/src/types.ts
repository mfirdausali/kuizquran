// Engine types — pure data, no DOM. The corpus subset mirrors the six-table
// shape emitted by packages/corpus-compiler (public/corpus.json).

export type WordClass = "N" | "V" | "P";

export interface Gloss {
  en: string | null;
  ms: string | null;
  ja: string | null;
}

export interface CorpusWord {
  ayah: number;
  position: number;
  text_uthmani: string;
  lemma: string | null;
  root: string | null;
  class: WordClass | null;
  gloss: Gloss;
  act: number | null;
  sceneImage: string | null;
}

export interface CorpusDistractor {
  ayah: number;
  position: number;
  rank: number;
  text: string;
  prd_rank: string;
  src_type: string;
  why: string;
}

export interface CorpusVerse {
  ayah: number;
  text_uthmani: string;
  page: number | null;
  line: number | null;
}

/** The slice of corpus.json the engine consumes. */
/** Narrative act (scene beat) — the placement landmarks (FR10). */
export interface CorpusSceneBeat {
  act: number;
  ayahRange: string;
  ayahs: number[];
  label: string;
  sourceName: string;
}

export interface Corpus {
  meta: { surah: number; ayahCount: number; wordCount: number };
  verses: CorpusVerse[];
  words: CorpusWord[];
  distractors: CorpusDistractor[];
  /** The 19 acts (placement landmarks); optional for older corpus subsets. */
  sceneBeats?: CorpusSceneBeat[];
}

// ---- Ladder ----

/** FR2 rungs. S4 = the bridge to the next ayah (v0.4). RC = v2 tap-to-reconstruct
 *  (v2-D05, ROADMAP Phase 1) — a DrillItem-only tag; on the wire (DrillEvent.rung)
 *  a reconstruct pass is recorded as its grading equivalence class "S2" (partial)
 *  or "S3" (whole-ayah production), never "RC" — see reconstruct.ts. */
export type Rung = "S1" | "S2" | "S3" | "S4" | "RC";

/** One presented drill question. */
export type DrillItem =
  | {
      rung: "S1";
      /** Arabic word being probed (its position identifies the lit word in the hero). */
      word: CorpusWord;
      /** Full ayah words in reading order — the hero renders the whole ayah with
       *  the target word lit and the rest dimmed (in-context meaning probe). */
      ayahWords: CorpusWord[];
      /** Gloss MCQ options (EN); exactly one is correct. */
      options: string[];
      correct: string;
      /** Reading-order index (1-based) and total for the header. */
      index: number;
      total: number;
    }
  | {
      rung: "S2";
      /** The full ayah words in reading order, for rendering the gapped ayah. */
      ayahWords: CorpusWord[];
      /** Position (1-based word position) of the current blank. */
      blankPosition: number;
      /** Arabic options for the blank (correct + ranked distractors). */
      options: string[];
      correct: string;
      index: number;
      total: number;
    }
  | {
      rung: "S3";
      /** All ayah words as a shuffled-for-display bank (display order decided by UI). */
      ayahWords: CorpusWord[];
      /** The next expected word position (reading order). */
      expectedPosition: number;
      index: number;
      total: number;
    }
  | {
      rung: "S4";
      /** The connection being born: this ayah (n) → the next (n+1). */
      fromAyah: number;
      toAyah: number;
      /** One of the NEXT ayah's opening words, probed as a meaning item. */
      word: CorpusWord;
      /** The next ayah's opening words in reading order (for the "what comes next" hero). */
      nextOpening: CorpusWord[];
      /** Gloss MCQ options (EN); exactly one is correct. */
      options: string[];
      correct: string;
      index: number;
      total: number;
    }
  | {
      rung: "RC";
      /** Full ayah words in reading order — grounded in the whole verse (v2-D23);
       *  non-blank positions render normally, blank positions render as gap-slots. */
      ayahWords: CorpusWord[];
      /** Positions currently hidden as gap-slots (reading order), scaled by strength
       *  band (v2-D05: more blanks as strength climbs — Learn 1 → Carry all). */
      blankPositions: number[];
      /** The blank position currently being filled — blanks fill in ascending
       *  (reading) order, one at a time. */
      currentBlank: number;
      /** Arabic tile bank for the CURRENT blank: correct form + band-scaled
       *  near-miss distractors (same pool as S2, via corpus.distractorsFor). */
      options: string[];
      correct: string;
      /** 1-based index of currentBlank within blankPositions, and total blanks
       *  in this pass. */
      index: number;
      total: number;
      /** True when this pass blanks the WHOLE ayah (Carry band) — grades as S3
       *  (encodes, schedules the gate) rather than S2 (partial reconstruction). */
      full: boolean;
    };

// ---- Chain / junction (FR4 Carry) ----

/** One step of a chain tap-through: recall an ayah, or cross a junction. */
export type ChainStep =
  | { kind: "ayah"; ref: number }
  | { kind: "junction"; from: number; to: number };

/** A presented junction check: "which ayah opens next?" MCQ. */
export interface JunctionItem {
  from: number;
  to: number;
  /** Arabic opening of the correct next ayah. */
  correct: string;
  /** Arabic opening options (correct + look-alike openings from other ayat). */
  options: string[];
}

/** Result of the ladder having no more items on the current rung/ayah. */
export interface LadderDone {
  done: true;
}

// ---- Events (append-only truth) ----

export type EventType =
  | "rung_start"
  | "tap"
  | "rung_complete"
  | "ayah_complete"
  | "gate_result" // day-1 cold gate attempt outcome
  | "connection_born" // S4 bridge created the n→n+1 connection atom
  | "junction_result" // a junction check outcome (crosses n→n+1)
  | "chain_step" // one traversed step of a chain drill (FIRe credit)
  | "interruption" // a session re-entry classified by resumePolicy (v0.6 metric)
  | "placement_probe" // a placement onboarding probe answer (v0.7)
  | "placement_result" // placement finished; carried map decided (v0.7)
  | "adoption" // untaught-ayah cold pass adopted into Carrying (v0.7 FR6)
  | "session_start" // app-open → first drill; latency = open-into-drill ms (v0.8)
  | "reconstruct_tap" // v2 Phase 1 (v2-D05): one tap-to-reconstruct blank-fill attempt
  | "ayah_produced" // v2 Phase 1: a reconstruct pass finished (all blanks filled) —
  // the graded completion event; `rung` carries "S2" (partial) or "S3" (whole-ayah).
  | "gate_demote"; // v2 Phase 2 (v2-D08): a learner-accepted "send back to Learn"
  // offer after repeated cold-gate fails — folds via gate.ts's demoteToLearn().

export interface DrillEvent {
  /** Stable client-generated id (uuid), assigned at creation. Idempotency key for
   *  server sync (D1 upsert by id). Optional in older records; the app stamps it. */
  id?: string;
  /** Monotonic per-session sequence, assigned by the event log on append. */
  seq?: number;
  type: EventType;
  ts: number;
  surah: number;
  ayah: number;
  rung: Rung;
  /** Word position the tap concerns (S1/S2/S3), when applicable. */
  position?: number;
  /** The chosen answer text (gloss for S1, Arabic for S2/S3). */
  choice?: string;
  /** Whether the tap was correct. */
  correct?: boolean;
  /** True when this is a first-pass meaning error → pretest, excluded from grading. */
  pretest?: boolean;
  /** For connection/junction/chain events: the target ayah (n+1) of the n→n+1 link.
   *  `ayah` holds the `from` (n); `to` holds n+1. */
  to?: number;
  /** For chain_step: whether this step traversed an ayah or a junction. */
  stepKind?: "ayah" | "junction";
  /** True when produced outside the structured session (free play) — evidence only. */
  structured?: boolean;
  /** Tap latency in ms (item-shown → tap). Excluded from time-per-word if the tap
   *  was interrupted (an interruption event brackets the window). v0.6 metric. */
  latency?: number;
  /** For interruption events: the resumePolicy classification. v0.6 metric. */
  resume?: "resume" | "restart" | "replan" | "makeup";
}
