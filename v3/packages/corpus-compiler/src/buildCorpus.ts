// Join a surah's inputs + QAC morphology into the six-table CorpusJson. Pure:
// takes already-parsed inputs, returns the corpus object. No I/O here.
//
// Ported from v1/packages/corpus-compiler/src/buildCorpus.ts (v3/CLAUDE.md's
// port source), surah-parameterized for build-plan step 3:
//  - `surah` is now a required input, not hardcoded 12, and is stamped onto
//    every row (E-01's corpus half — v3/DEFECTS.md#E-01).
//  - `mcqItems` (authored distractors) and `mentalModel` (acts/scene beats)
//    are now OPTIONAL. Only surah 12 has either today; surahs 103 and 112
//    compile with zero distractors and zero scene beats rather than crashing
//    or inventing content — v1 crashed on any surah without both, which is
//    exactly the "degenerate surahs are the common case" defect this step
//    exists to fix. Foil-kernel distractor generation (NIGHTLY.md
//    "Distractors — decided") is intentionally NOT implemented here; it is
//    separate follow-on work, not named in this step.

import type {
  CorpusJson,
  Distractor,
  RawGeometryVerse,
  RawMcqItem,
  RawMentalModel,
  RawVerse,
  Verse,
  Word,
  WordMorph,
  WordRef,
} from "./types.ts";
import { SCHEMA_VERSION } from "./types.ts";
import { buildConnections } from "./connections.ts";
import { buildLookAlikes, type CuratedThread } from "./lookalikes.ts";
import { ayahToAct, buildSceneBeats } from "./sceneBeats.ts";
import { mapPrdRank } from "./prdRank.ts";
import { HASH_SPEC_VERSION } from "./hash.ts";

export interface BuildInputs {
  surah: number;
  verses: RawVerse[];
  /** Authored distractor items — [] when this surah has none. */
  mcqItems: RawMcqItem[];
  /** Authored narrative mental model — undefined when this surah has none. */
  mentalModel?: RawMentalModel;
  /** Surah's morphology, keyed "ayah:position". */
  morph: Map<string, WordMorph>;
  /** Curated look-alike threads for this surah (empty for surahs without one). */
  curatedThreads?: CuratedThread[];
  /** Scene-beat labels for this surah's acts (empty for surahs without one). */
  sceneBeatLabels?: Record<number, string>;
  /** Vendored mushaf geometry (page/line) — undefined when this surah has
   * none yet (build-plan step 4; edge case #63's degraded mode). */
  geometry?: RawGeometryVerse[];
  generatedFrom: string[];
}

export function buildCorpus(inp: BuildInputs): CorpusJson {
  const { surah, verses, mcqItems, mentalModel, morph } = inp;

  const ayahCount = verses.length;
  const actByAyah = mentalModel ? ayahToAct(mentalModel.acts) : new Map<number, { act: number; sceneImage: string | null }>();

  // Index morphology + the mcq target root, for distractor rank mapping.
  const morphOf = (ayah: number, position: number): WordMorph =>
    morph.get(`${ayah}:${position}`) ?? { lemma: null, root: null, class: null };

  // Root lookup for any same-surah word form (to detect same-root distractors
  // that happen to also be a word of this surah). Keyed by normalized-free
  // exact text match on the mcq `word`/`correct`; here we only have roots for
  // target positions, so the distractor root is looked up when the distractor
  // equals a known target form. That is best-effort — most distractors are
  // out-of-surah.
  const rootByText = new Map<string, string>();
  for (const item of mcqItems) {
    const m = morphOf(item.verse, item.position);
    if (m.root) rootByText.set(item.correct, m.root);
  }

  // ---- geometry (mushaf page/line — build-plan step 4) ----
  // Optional, like mcqItems/mentalModel: a surah without vendored geometry
  // compiles with page/line all null (edge case #63's degraded mode), not a
  // hard failure. When geometry IS supplied, every ayah's word-geometry
  // count must match the ayah's actual word count exactly — a mismatch
  // means the geometry source disagrees with the verse source about word
  // boundaries, and zipping them positionally under that disagreement would
  // silently mis-map line numbers onto the wrong words (the same class of
  // bug E-01 names for atom keys: fail loud, not silent).
  const geometryByAyah = new Map<number, RawGeometryVerse>();
  if (inp.geometry) {
    for (const g of inp.geometry) geometryByAyah.set(g.verse_number, g);
    for (const v of verses) {
      const g = geometryByAyah.get(v.verse_number);
      if (!g) {
        throw new Error(`geometry missing for surah ${surah} ayah ${v.verse_number}`);
      }
      if (g.words.length !== v.words.length) {
        throw new Error(
          `geometry/word-count mismatch: surah ${surah} ayah ${v.verse_number} has ` +
            `${v.words.length} word(s) but geometry has ${g.words.length}`,
        );
      }
    }
  }
  const hasGeometry = inp.geometry !== undefined;
  const lineOf = (ayah: number, position: number): number | null => {
    if (!hasGeometry) return null;
    const g = geometryByAyah.get(ayah)!;
    return g.words.find((w) => w.position === position)?.line_number ?? null;
  };

  // ---- verses ----
  const versesOut: Verse[] = verses.map((v) => ({
    surah,
    ayah: v.verse_number,
    text_uthmani: v.text_uthmani.trim(),
    page: hasGeometry ? geometryByAyah.get(v.verse_number)!.page_number : null,
  }));

  // ---- words ----
  const wordsOut: Word[] = [];
  for (const v of verses) {
    const act = actByAyah.get(v.verse_number) ?? null;
    for (const w of v.words) {
      const m = morphOf(v.verse_number, w.position);
      wordsOut.push({
        surah,
        ayah: v.verse_number,
        position: w.position,
        text_uthmani: w.text_uthmani,
        lemma: m.lemma,
        root: m.root,
        class: m.class,
        gloss: { en: w.translation, ms: null, ja: null },
        act: act ? act.act : null,
        sceneImage: act ? act.sceneImage : null,
        line: lineOf(v.verse_number, w.position),
      });
    }
  }

  // ---- distractors (drop self-collisions, map prd_rank, preserve order) ----
  const distractorsOut: Distractor[] = [];
  const droppedCollisions: WordRef[] = [];
  for (const item of mcqItems) {
    const targetMorph = morphOf(item.verse, item.position);
    let rank = 0;
    let droppedHere = false;
    for (const d of item.distractors) {
      if (d.text === item.correct) {
        droppedHere = true;
        continue; // drop self-collision; do not advance rank
      }
      rank++;
      const prd_rank = mapPrdRank({
        targetText: item.correct,
        targetRoot: targetMorph.root,
        distractorText: d.text,
        distractorRoot: rootByText.get(d.text) ?? null,
        srcType: d.type,
      });
      distractorsOut.push({
        surah,
        ayah: item.verse,
        position: item.position,
        rank,
        text: d.text,
        prd_rank,
        src_type: d.type,
        why: d.why,
      });
    }
    if (droppedHere) droppedCollisions.push({ ayah: item.verse, position: item.position });
  }

  // ---- connections / lookalikes / scene beats ----
  const connections = buildConnections(surah, ayahCount);
  const lookalikes = buildLookAlikes(surah, verses, inp.curatedThreads ?? []);
  const sceneBeats = mentalModel ? buildSceneBeats(surah, mentalModel.acts, inp.sceneBeatLabels ?? {}) : [];

  return {
    meta: {
      surah,
      ayahCount,
      wordCount: wordsOut.length,
      generatedFrom: inp.generatedFrom,
      droppedCollisions,
      distractorsAuthored: mcqItems.length > 0,
      hasMentalModel: mentalModel !== undefined,
      hasGeometry,
      schemaVersion: SCHEMA_VERSION,
      hashSpecVersion: HASH_SPEC_VERSION,
    },
    verses: versesOut,
    words: wordsOut,
    distractors: distractorsOut,
    connections,
    lookalikes,
    sceneBeats,
  };
}
