// CLI entry: read inputs → build corpus → validate → write public/corpus.json
// and docs/corpus-report.md. Exits non-zero if validation hard-fails.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildFromInputs, loadInputs, PUBLIC_CORPUS, REPORT_PATH } from "./io.ts";
import { formatReport, validateCorpus } from "./validate.ts";
import { buildReport } from "./report.ts";

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

const inp = loadInputs();
const corpus = buildFromInputs(inp);
const validation = validateCorpus(corpus, inp.verses, inp.qac.fullQuranWordSet);

writeFile(PUBLIC_CORPUS, JSON.stringify(corpus, null, 2) + "\n");
writeFile(REPORT_PATH, buildReport(corpus, validation));

console.log(formatReport(validation));
console.log("");
console.log(`wrote ${PUBLIC_CORPUS}`);
console.log(`wrote ${REPORT_PATH}`);
console.log(
  `corpus: ${corpus.verses.length} verses, ${corpus.words.length} words, ` +
    `${corpus.distractors.length} distractors, ${corpus.connections.length} connections, ` +
    `${corpus.lookalikes.length} look-alikes, ${corpus.sceneBeats.length} scene beats`,
);

process.exit(validation.ok ? 0 : 1);
