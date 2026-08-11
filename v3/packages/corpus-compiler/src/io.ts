// Path resolution + input loading, shared by compile and validate.
//
// Ported from v1/packages/corpus-compiler/src/io.ts, surah-parameterized for
// build-plan step 3: v1 always read data/yusuf-*.json for surah 12. v3 reads
// data/raw/<surah>-verses.json (required — every launch surah needs verse
// text) and data/raw/<surah>-mcq-items.json / <surah>-mental-model.json
// (both OPTIONAL — only surah 12 has authored distractors/mental-model data
// today; a surah without them compiles with empty distractors/scene beats,
// per v3/DECISIONS.md's "degenerate surahs are the common case" framing).
//
// All inputs are vendored under this package's own data/ directory — v3
// never reads from v1/ or v2/ at runtime (CLAUDE.md: v3 is a new generation,
// not a migration).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RawGeometryVerse, RawMcqItem, RawMentalModel, RawVerse, Word, WordMorph } from "./types.ts";
import { parseQac, type QacData } from "./parseQac.ts";
import { buildCorpus } from "./buildCorpus.ts";
import { buildPool, type PoolEntry } from "./foilKernels.ts";
import type { CorpusJson } from "./types.ts";
import { MULK_SCENE_BEAT_LABELS, YUSUF_SCENE_BEAT_LABELS } from "./sceneBeats.ts";

const HERE = dirname(fileURLToPath(import.meta.url)); // .../packages/corpus-compiler/src
export const PKG_ROOT = resolve(HERE, ".."); // .../v3/packages/corpus-compiler
export const DATA_DIR = resolve(PKG_ROOT, "data", "raw");
export const OUTPUT_DIR = resolve(PKG_ROOT, "output");
export const QAC_PATH = resolve(DATA_DIR, "quran-morphology.txt");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readJsonIfExists<T>(path: string): T | undefined {
  return existsSync(path) ? readJson<T>(path) : undefined;
}

/** Surah-specific extras not derivable from the generic per-surah files —
 * scene-beat labels (English prose, authored in v1, no Arabic). Curated
 * look-alike word-threads are NOT carried forward from v1 — see
 * lookalikes.ts's comment on why. */
function curatedExtrasFor(surah: number): {
  curatedThreads: import("./lookalikes.ts").CuratedThread[];
  sceneBeatLabels: Record<number, string>;
} {
  if (surah === 12) {
    return { curatedThreads: [], sceneBeatLabels: YUSUF_SCENE_BEAT_LABELS };
  }
  // Surah 67 (Al-Mulk). Wired BEFORE the labels are written, deliberately: with
  // the plumbing missing, a human could author every label in
  // MULK_SCENE_BEAT_LABELS and the compiler would still emit TODO placeholders,
  // because this function returned `{}` for every surah but 12. That is a
  // silent no-op on authored human work — the worst way to waste someone's
  // afternoon. Empty today, and safe empty: the freeze gate fails on TODO
  // labels, so nothing ships unauthored.
  if (surah === 67) {
    return { curatedThreads: [], sceneBeatLabels: MULK_SCENE_BEAT_LABELS };
  }
  return { curatedThreads: [], sceneBeatLabels: {} };
}

export interface LoadedInputs {
  surah: number;
  verses: RawVerse[];
  mcqItems: RawMcqItem[];
  mentalModel?: RawMentalModel;
  /** Vendored mushaf geometry — undefined when this surah has none yet
   * (build-plan step 4). */
  geometry?: RawGeometryVerse[];
  qac: QacData;
  generatedFrom: string[];
}

export function loadInputs(surah: number): LoadedInputs {
  const versesPath = resolve(DATA_DIR, `${surah}-verses.json`);
  if (!existsSync(versesPath)) {
    throw new Error(
      `no vendored verse data for surah ${surah} at ${versesPath} — fetch it first ` +
        `(curl, vendored; see v3/packages/corpus-compiler/data/raw/README.md)`,
    );
  }
  const verses = readJson<RawVerse[]>(versesPath);
  const mcqItems = readJsonIfExists<RawMcqItem[]>(resolve(DATA_DIR, `${surah}-mcq-items.json`)) ?? [];
  const mentalModel = readJsonIfExists<RawMentalModel>(resolve(DATA_DIR, `${surah}-mental-model.json`));
  const geometry = readJsonIfExists<RawGeometryVerse[]>(resolve(DATA_DIR, `${surah}-geometry.json`));
  const qac = parseQac(QAC_PATH);

  const generatedFrom = [
    `v3/packages/corpus-compiler/data/raw/${surah}-verses.json`,
    ...(mcqItems.length > 0 ? [`v3/packages/corpus-compiler/data/raw/${surah}-mcq-items.json`] : []),
    ...(mentalModel ? [`v3/packages/corpus-compiler/data/raw/${surah}-mental-model.json`] : []),
    ...(geometry ? [`v3/packages/corpus-compiler/data/raw/${surah}-geometry.json`] : []),
    "v3/packages/corpus-compiler/data/raw/quran-morphology.txt (QAC v0.4)",
  ];
  return { surah, verses, mcqItems, mentalModel, geometry, qac, generatedFrom };
}

/** Every surah with vendored Uthmani verse data — the foil-kernel candidate
 * pool's source. Derived from the data directory rather than hardcoded, so
 * vendoring a new surah widens the pool automatically. */
export function vendoredSurahs(): number[] {
  return readdirSync(DATA_DIR)
    .map((f) => /^(\d+)-verses\.json$/.exec(f)?.[1])
    .filter((s): s is string => s !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
}

/**
 * Build the foil-kernel candidate pool: every distinct word form of every
 * vendored surah's UTHMANI text, tagged with the roots QAC gives it.
 *
 * The pool is Uthmani corpus bytes, NOT QAC's reconstructed forms — measured,
 * only 1045 of 1806 QAC forms are byte-identical to their Uthmani counterpart,
 * so a QAC-sourced foil would render in a visibly different orthographic style
 * from the correct answer and give the tile away for free. See foilKernels.ts.
 */
export function buildFoilPool(qac: QacData): Map<string, PoolEntry> {
  const wordsBySurah = new Map<number, Word[]>();
  for (const surah of vendoredSurahs()) {
    const verses = readJson<RawVerse[]>(resolve(DATA_DIR, `${surah}-verses.json`));
    const morph = qac.morphBySurah.get(surah) ?? new Map<string, WordMorph>();
    const words: Word[] = [];
    for (const v of verses) {
      for (const w of v.words) {
        const m = morph.get(`${v.verse_number}:${w.position}`);
        words.push({
          surah,
          ayah: v.verse_number,
          position: w.position,
          text_uthmani: w.text_uthmani,
          lemma: m?.lemma ?? null,
          root: m?.root ?? null,
          class: m?.class ?? null,
          gloss: { en: w.translation, ms: null, ja: null },
          act: null,
          sceneImage: null,
          line: null,
        });
      }
    }
    wordsBySurah.set(surah, words);
  }
  return buildPool(wordsBySurah);
}

/** Build the corpus object from freshly-loaded inputs. */
export function buildFromInputs(inp: LoadedInputs): CorpusJson {
  const morph = inp.qac.morphBySurah.get(inp.surah) ?? new Map();
  const extras = curatedExtrasFor(inp.surah);
  return buildCorpus({
    surah: inp.surah,
    verses: inp.verses,
    mcqItems: inp.mcqItems,
    mentalModel: inp.mentalModel,
    geometry: inp.geometry,
    morph,
    foilPool: buildFoilPool(inp.qac),
    curatedThreads: extras.curatedThreads,
    sceneBeatLabels: extras.sceneBeatLabels,
    generatedFrom: inp.generatedFrom,
  });
}
