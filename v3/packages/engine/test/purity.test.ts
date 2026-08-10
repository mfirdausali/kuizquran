// Absolute A (INVARIANTS.md): no DOM, no IO, no Date.now(), no Math.random(),
// no crypto, no zero-arg new Date(), no local-date getters. `now`/`tz` are
// always passed in.
//
// Build-plan step 8 (the tz-explicit daybound rewrite) closed every local-
// date-getter violation this package had: daybound.ts (INVARIANTS.md's own
// named example), decay.ts's `sinceLabel()` and sessionSummary.ts's
// `hourOf` default (two more instances of the same bug class, found by this
// test rather than named in advance — see v3/DECISIONS.md and the step-8
// commit for the trail). The carve-out below is now empty; if this test
// ever needs a new entry, that is itself a purity regression worth pausing
// on, not a routine addition.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(HERE, "..", "src");

/** Empty since build-plan step 8. Kept as a named, typed set (not deleted)
 * so a future regression has an obvious place to land — and so landing
 * something here is a visible, deliberate act, not a silent bypass. */
const KNOWN_LOCAL_DATE_GETTER_VIOLATIONS = new Set<string>();

const BANNED_PATTERNS: Array<{ name: string; re: RegExp; exempt?: Set<string> }> = [
  { name: "Date.now()", re: /\bDate\.now\s*\(/ },
  { name: "Math.random()", re: /\bMath\.random\s*\(/ },
  { name: "crypto", re: /\bcrypto\b/ },
  { name: "zero-arg new Date()", re: /new Date\s*\(\s*\)/ },
  {
    name: "local-date getters (getFullYear/getMonth/getDate/getDay/getHours/getMinutes/getSeconds)",
    re: /\.(getFullYear|getMonth|getDate|getDay|getHours|getMinutes|getSeconds)\s*\(/,
    exempt: KNOWN_LOCAL_DATE_GETTER_VIOLATIONS,
  },
];

function engineSourceFiles(): string[] {
  return readdirSync(SRC_DIR).filter((f) => f.endsWith(".ts"));
}

/** Strip `//` line comments and block/JSDoc comments before matching, so a
 * comment that MENTIONS a banned pattern (e.g. a JSDoc line describing what
 * `Date.getDay()`'s convention means) doesn't false-positive as a real
 * usage. Deliberately simple — no string-literal awareness (this codebase's
 * style has no comment-opener sequences inside string literals) and no
 * handling for nested block comments (JS/TS doesn't have them). */
function codeOnly(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

function matchingFiles(re: RegExp): string[] {
  return engineSourceFiles().filter((f) => re.test(codeOnly(readFileSync(resolve(SRC_DIR, f), "utf8"))));
}

describe("Absolute A — the engine is pure", () => {
  for (const { name, re, exempt } of BANNED_PATTERNS) {
    it(`no file uses ${name}, outside the documented carve-out`, () => {
      const offenders = matchingFiles(re).filter((f) => !exempt?.has(f));
      expect(offenders, `files using ${name}`).toEqual([]);
    });
  }

  it("the documented carve-out is the ONLY set with local-date getters (fails loud if it drifts)", () => {
    const re = BANNED_PATTERNS.find((p) => p.name.startsWith("local-date"))!.re;
    expect(matchingFiles(re).sort()).toEqual([...KNOWN_LOCAL_DATE_GETTER_VIOLATIONS].sort());
  });
});
