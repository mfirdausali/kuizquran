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
import { admitAuthored, generateFoils, type KernelContext, type PoolEntry } from "./foilKernels.ts";

/** Foils generated per un-authored word. 5 matches the authored surahs' shape
 * (surah 12 ships 5 per word, 4 after a collision drop) and gives the engine's
 * Learn band (maxRank 4, count 4) a full set with one in reserve. */
const MAX_KERNEL_FOILS = 5;

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
  /** Candidate forms the foil kernels may DERIVE distractors from, keyed by
   * engine grading key (see foilKernels.ts `buildPool`). Every entry's
   * `surface` is real corpus bytes. Omitted/empty => no kernel generation, so
   * a caller that supplies no pool gets exactly the previous behaviour. */
  foilPool?: Map<string, PoolEntry>;
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

  // ---- distractors ----
  // PRECEDENCE (NIGHTLY.md: "Yusuf's authored distractors stay as an override
  // layer where they exist. Kernels are the baseline everywhere else"):
  // per-COORDINATE, whole-set, authored wins. For each (ayah, position), if
  // authored rows exist that coordinate is authored-only and kernels do not run
  // there; otherwise kernels fill it.
  //
  // Whole-set rather than row-merged is deliberate: merging authored rows with
  // generated ones at a single coordinate would interleave two different rank
  // semantics (authored order vs. merged kernel score) and produce a gradient
  // that is neither. Per-COORDINATE rather than per-surah means a future
  // partially-authored surah works correctly with no schema change, even though
  // no such surah exists today (surah 12 is authored on all 1777 coordinates).
  //
  // Every row — authored OR kernel — passes through a FoilSet accumulator whose
  // equality is the ENGINE's grading key. That is what makes defects #7 and #9
  // structurally impossible rather than checked: see foilKernels.ts. It also
  // FIXES three live authored rows in surah 12 (12:21 p15, 12:22 p7, 12:24 p11)
  // that are each the target plus one U+0640 tatweel — byte-different, so the
  // old `d.text === item.correct` drop missed them, but grade-IDENTICAL, so
  // 12:21 p15 shipped a two-correct-answer option set at Learn and Reinforce.
  const distractorsOut: Distractor[] = [];
  const droppedCollisions: WordRef[] = [];
  const authoredCoords = new Set<string>();

  for (const item of mcqItems) {
    const coord = `${item.verse}:${item.position}`;
    authoredCoords.add(coord);
    const targetMorph = morphOf(item.verse, item.position);

    const kept = admitAuthored(
      item.correct,
      item.distractors.map((d) => ({ surface: d.text, srcType: d.type, why: d.why })),
    );
    if (kept.length !== item.distractors.length) {
      droppedCollisions.push({ ayah: item.verse, position: item.position });
    }

    let rank = 0;
    for (const d of kept) {
      rank++;
      distractorsOut.push({
        surah,
        ayah: item.verse,
        position: item.position,
        rank,
        text: d.surface,
        prd_rank: mapPrdRank({
          targetText: item.correct,
          targetRoot: targetMorph.root,
          distractorText: d.surface,
          distractorRoot: rootByText.get(d.surface) ?? null,
          srcType: d.srcType,
        }),
        src_type: d.srcType,
        why: d.why,
        origin: "authored",
      });
    }
  }

  // Kernel fill for every coordinate WITHOUT authored rows.
  if (inp.foilPool && inp.foilPool.size > 0) {
    const ctx: KernelContext = { pool: inp.foilPool, surahWords: wordsOut };
    for (const w of wordsOut) {
      if (authoredCoords.has(`${w.ayah}:${w.position}`)) continue;
      const foils = generateFoils(w, ctx, MAX_KERNEL_FOILS);
      let rank = 0;
      for (const f of foils) {
        rank++;
        distractorsOut.push({
          surah,
          ayah: w.ayah,
          position: w.position,
          rank,
          text: f.surface,
          prd_rank: mapPrdRank({
            targetText: w.text_uthmani,
            targetRoot: w.root,
            distractorText: f.surface,
            distractorRoot: rootByText.get(f.surface) ?? null,
            srcType: f.srcType,
          }),
          src_type: f.srcType,
          why: f.why,
          origin: "kernel",
        });
      }
    }
  }

  // Provenance summary + honest-degradation histogram.
  let authoredRows = 0;
  let kernelRows = 0;
  const perWord = new Map<string, number>();
  for (const d of distractorsOut) {
    if (d.origin === "authored") authoredRows++;
    else kernelRows++;
    const k = `${d.ayah}:${d.position}`;
    perWord.set(k, (perWord.get(k) ?? 0) + 1);
  }
  const kernelYield: Record<number, number> = {};
  for (const w of wordsOut) {
    const n = perWord.get(`${w.ayah}:${w.position}`) ?? 0;
    kernelYield[n] = (kernelYield[n] ?? 0) + 1;
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
      distractorOrigin: { authored: authoredRows, kernel: kernelRows },
      kernelYield,
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
