// Absolute A (INVARIANTS.md): no DOM, no IO, no Date.now(), no Math.random(),
// no crypto, no zero-arg new Date(), no local-date getters. `now`/`tz` are
// always passed in.
//
// KNOWN, deliberate violations survive the step-5 verbatim port. Step 5 is
// "port verbatim, bugs included" so step 6's golden-log parity has the
// original buggy behavior to diff against; the "tz-explicit daybound
// rewrite" is build-plan step 8, not this one. This test enforces purity
// everywhere else NOW and will start failing each carve-out entry the
// moment step 8's rewrite reaches it — entries should be DELETED as they're
// fixed, never added to once step 8 starts.
//
// - daybound.ts — INVARIANTS.md's own named example ("v2/daybound.ts:23,49
//   uses machine-local dates").
// - decay.ts — `sinceLabel()`'s `new Date(since).getDay()` (the "since
//   Thursday" weekday label): same bug class, NOT previously named in
//   INVARIANTS.md or DEFECTS.md. Found by this test, not by prior audit —
//   step 8's scope should cover this file too, not just daybound.ts.
// - sessionSummary.ts — `hourOf`'s default `(ts) => new Date(ts).getHours()`:
//   same bug class, same "not previously named" note. The default is
//   overridable by callers, which is why it shipped unnoticed; it is still
//   an impure default and belongs in step 8's scope.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(HERE, "..", "src");

/** build-plan step 8 fixes these; until then they're the documented
 * exceptions to Absolute A in this package. */
const KNOWN_LOCAL_DATE_GETTER_VIOLATIONS = new Set(["daybound.ts", "decay.ts", "sessionSummary.ts"]);

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

/** Strip `//` line comments before matching, so a comment that MENTIONS a
 * banned pattern (e.g. daybound.ts's own "the engine never calls Date.now()"
 * doc comment) doesn't false-positive as a real usage. Deliberately simple —
 * no block-comment or string-literal awareness — good enough for this
 * codebase's style (no `//` inside string literals in this package). */
function codeOnly(content: string): string {
  return content
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
