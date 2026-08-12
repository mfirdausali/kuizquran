// CLI entry: recompute a surah's tiered hash table with overrides applied,
// without recompiling the corpus. DEFECTS.md#B3's own "explicitly deferred"
// gap — Laravel spawns this the moment an override is written, so the
// verification frontier's hash comparison reflects it immediately rather
// than waiting for a human to hand-run `corpus:ingest-hashes` again.
//
// v3-D08: Laravel never computes a hash. This stays the ONE hash
// implementation (TS); Laravel only stores what this prints.
//
// usage:   node --experimental-strip-types recomputeHashes.ts <path/to/corpus.json>
// stdin:   a JSON array of HashOverride rows (hash.ts's own shape) — for
//          the WHOLE surah, unfiltered by ayah; buildAyahHashTableWithOverrides
//          scopes each override to its own ayah internally. Empty/absent
//          stdin is equivalent to "no overrides" (the baseline table).
// stdout:  on success, the AyahHashRow[] table as one line of JSON, exit 0.
//          on any failure, `{ "error": string }` as one line of JSON, exit 1
//          — contracted to print JSON on EVERY path (mirrors
//          worker/fold-runner's bin/*.ts runners) so a caller never has to
//          guess from an empty pipe or a stack trace on stderr.

import { readFileSync } from "node:fs";
import { buildAyahHashTableWithOverrides } from "./manifest.ts";
import type { HashOverride } from "./hash.ts";
import type { CorpusJson } from "./types.ts";

function fail(message: string): never {
  console.log(JSON.stringify({ error: message }));
  process.exit(1);
}

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

const corpusPath = process.argv[2];
if (!corpusPath) {
  fail("usage: recomputeHashes.ts <path/to/corpus.json> (HashOverride[] JSON on stdin, optional)");
}

let corpus: CorpusJson;
try {
  corpus = JSON.parse(readFileSync(corpusPath, "utf8")) as CorpusJson;
} catch (e) {
  fail(`could not read/parse corpus file at ${corpusPath}: ${(e as Error).message}`);
}

let overrides: HashOverride[] = [];
const stdin = readStdin().trim();
if (stdin !== "") {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdin);
  } catch (e) {
    fail(`could not parse overrides JSON on stdin: ${(e as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    fail("overrides JSON on stdin must be an array");
  }
  overrides = parsed as HashOverride[];
}

console.log(JSON.stringify(buildAyahHashTableWithOverrides(corpus, overrides)));
