// CLI entry: read a surah number, build its corpus, validate, write
// output/<surah>/corpus.json and output/<surah>/corpus-report.md.
// Exits non-zero if validation hard-fails.
//
// Ported from v1/packages/corpus-compiler/src/compile.ts, surah-parameterized
// (build-plan step 3): usage is now `compile.ts <surah>` instead of always
// compiling Yusuf, and output is namespaced per surah so 12/103/112 don't
// clobber each other.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadInputs, buildFromInputs, OUTPUT_DIR } from "./io.ts";
import { formatReport, validateCorpus } from "./validate.ts";
import { buildReport } from "./report.ts";

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

const inp = loadInputs(surah);
const corpus = buildFromInputs(inp);
const validation = validateCorpus(corpus, inp.verses, inp.qac.fullQuranWordSet);

writeFile(outCorpus, JSON.stringify(corpus, null, 2) + "\n");
writeFile(outReport, buildReport(corpus, validation));

console.log(formatReport(surah, validation));
console.log("");
console.log(`wrote ${outCorpus}`);
console.log(`wrote ${outReport}`);
console.log(
  `surah ${surah}: ${corpus.verses.length} verses, ${corpus.words.length} words, ` +
    `${corpus.distractors.length} distractors, ${corpus.connections.length} connections, ` +
    `${corpus.lookalikes.length} look-alikes, ${corpus.sceneBeats.length} scene beats`,
);

process.exit(validation.ok ? 0 : 1);
