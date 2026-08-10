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

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RawGeometryVerse, RawMcqItem, RawMentalModel, RawVerse } from "./types.ts";
import { parseQac, type QacData } from "./parseQac.ts";
import { buildCorpus } from "./buildCorpus.ts";
import type { CorpusJson } from "./types.ts";
import { YUSUF_SCENE_BEAT_LABELS } from "./sceneBeats.ts";

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
    curatedThreads: extras.curatedThreads,
    sceneBeatLabels: extras.sceneBeatLabels,
    generatedFrom: inp.generatedFrom,
  });
}
