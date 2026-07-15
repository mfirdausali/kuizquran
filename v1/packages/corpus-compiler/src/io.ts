// Path resolution + input loading, shared by compile and validate.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RawMcqItem, RawMentalModel, RawVerse } from "./types.ts";
import { parseQac, type QacData } from "./parseQac.ts";
import { buildCorpus } from "./buildCorpus.ts";
import type { CorpusJson } from "./types.ts";

const HERE = dirname(fileURLToPath(import.meta.url)); // .../packages/corpus-compiler/src
export const PKG_ROOT = resolve(HERE, ".."); // .../packages/corpus-compiler
export const REPO_ROOT = resolve(PKG_ROOT, "..", ".."); // .../v1
/** kuizquran/data — one level above the v1 repo root. */
export const DATA_DIR = resolve(REPO_ROOT, "..", "data");
export const RAW_DIR = resolve(REPO_ROOT, "data", "raw");
export const PUBLIC_CORPUS = resolve(REPO_ROOT, "public", "corpus.json");
export const REPORT_PATH = resolve(REPO_ROOT, "docs", "corpus-report.md");
export const QAC_PATH = resolve(RAW_DIR, "quran-morphology.txt");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export interface LoadedInputs {
  verses: RawVerse[];
  mcqItems: RawMcqItem[];
  mentalModel: RawMentalModel;
  qac: QacData;
  generatedFrom: string[];
}

export function loadInputs(): LoadedInputs {
  const verses = readJson<RawVerse[]>(resolve(DATA_DIR, "yusuf-verses.json"));
  const mcqItems = readJson<RawMcqItem[]>(resolve(DATA_DIR, "yusuf-mcq-items.json"));
  const mentalModel = readJson<RawMentalModel>(resolve(DATA_DIR, "yusuf-mental-model.json"));
  const qac = parseQac(QAC_PATH);
  return {
    verses,
    mcqItems,
    mentalModel,
    qac,
    generatedFrom: [
      "kuizquran/data/yusuf-verses.json",
      "kuizquran/data/yusuf-mcq-items.json",
      "kuizquran/data/yusuf-mental-model.json",
      "data/raw/quran-morphology.txt (QAC v0.4)",
    ],
  };
}

/** Build the corpus object from freshly-loaded inputs. */
export function buildFromInputs(inp: LoadedInputs): CorpusJson {
  return buildCorpus({
    verses: inp.verses,
    mcqItems: inp.mcqItems,
    mentalModel: inp.mentalModel,
    morph: inp.qac.yusufMorph,
    generatedFrom: inp.generatedFrom,
  });
}
