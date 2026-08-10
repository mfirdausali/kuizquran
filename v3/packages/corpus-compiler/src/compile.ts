// CLI entry: read a surah number, build its corpus, validate, write
// output/<surah>/corpus.json and output/<surah>/corpus-report.md.
// Exits non-zero if validation hard-fails.
//
// Ported from v1/packages/corpus-compiler/src/compile.ts, surah-parameterized
// (build-plan step 3): usage is now `compile.ts <surah>` instead of always
// compiling Yusuf, and output is namespaced per surah so 12/103/112 don't
// clobber each other.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadInputs, buildFromInputs, OUTPUT_DIR } from "./io.ts";
import { formatReport, validateCorpus } from "./validate.ts";
import { buildReport } from "./report.ts";
import {
  buildAyahHashTable,
  contentAddressedFilename,
  corpusManifestEntry,
  mergeManifest,
  serializeCorpus,
  type Manifest,
} from "./manifest.ts";

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

const surah = Number(process.argv[2]);
if (!Number.isInteger(surah) || surah < 1) {
  console.error("usage: compile.ts <surah>");
  process.exit(2);
}

const outCorpus = resolve(OUTPUT_DIR, String(surah), "corpus.json");
const outReport = resolve(OUTPUT_DIR, String(surah), "corpus-report.md");
const outHashes = resolve(OUTPUT_DIR, String(surah), "hashes.json");
const outManifest = resolve(OUTPUT_DIR, "manifest.json");

const inp = loadInputs(surah);
const corpus = buildFromInputs(inp);
const validation = validateCorpus(corpus, inp.verses, inp.qac.fullQuranWordSet);

// Content-addressed corpus file (16-hex — build-plan step 4): the filename
// is derived from these exact bytes, so it and the manifest's corpusHash
// always agree. `corpus.json` is kept alongside it as a stable dev
// convenience path — the manifest is the one thing the app actually reads.
const corpusBytes = serializeCorpus(corpus);
const outCorpusAddressed = resolve(OUTPUT_DIR, String(surah), contentAddressedFilename(corpus));
writeFile(outCorpusAddressed, corpusBytes);
writeFile(outCorpus, corpusBytes);
writeFile(outReport, buildReport(corpus, validation));
writeFile(outHashes, JSON.stringify(buildAyahHashTable(corpus), null, 2) + "\n");

const existingManifest: Manifest = existsSync(outManifest)
  ? (JSON.parse(readFileSync(outManifest, "utf8")) as Manifest)
  : { surahs: {} };
const manifest = mergeManifest(existingManifest, corpusManifestEntry(corpus));
writeFile(outManifest, JSON.stringify(manifest, null, 2) + "\n");

console.log(formatReport(surah, validation));
console.log("");
console.log(`wrote ${outCorpusAddressed}`);
console.log(`wrote ${outCorpus} (dev convenience copy)`);
console.log(`wrote ${outReport}`);
console.log(`wrote ${outHashes}`);
console.log(`wrote ${outManifest}`);
console.log(
  `surah ${surah}: ${corpus.verses.length} verses, ${corpus.words.length} words, ` +
    `${corpus.distractors.length} distractors, ${corpus.connections.length} connections, ` +
    `${corpus.lookalikes.length} look-alikes, ${corpus.sceneBeats.length} scene beats, ` +
    `hasGeometry=${corpus.meta.hasGeometry}`,
);

process.exit(validation.ok ? 0 : 1);
