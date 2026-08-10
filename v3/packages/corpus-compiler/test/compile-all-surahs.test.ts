// End-to-end: compile all three launch-fixture surahs (12, 103, 112) from
// their vendored inputs and assert validateCorpus() reports no hard failure.
// This is build-plan step 3's exit bar: "compiles 12+103+112". Only counts
// and boolean flags are asserted — never Arabic text (v3/INVARIANTS.md
// Absolute B).

import { describe, expect, it } from "vitest";
import { loadInputs, buildFromInputs } from "../src/io.ts";
import { validateCorpus } from "../src/validate.ts";

describe("compiles 12 + 103 + 112 (build-plan step 3 exit bar)", () => {
  const cases: Array<{ surah: number; ayahCount: number; wordCount: number; hasAuthoredExtras: boolean }> = [
    { surah: 12, ayahCount: 111, wordCount: 1777, hasAuthoredExtras: true },
    { surah: 103, ayahCount: 3, wordCount: 14, hasAuthoredExtras: false },
    { surah: 112, ayahCount: 4, wordCount: 15, hasAuthoredExtras: false },
  ];

  for (const c of cases) {
    it(`surah ${c.surah} compiles green with the expected shape`, () => {
      const inp = loadInputs(c.surah);
      const corpus = buildFromInputs(inp);
      const report = validateCorpus(corpus, inp.verses, inp.qac.fullQuranWordSet);

      expect(report.ok).toBe(true);
      expect(corpus.meta.ayahCount).toBe(c.ayahCount);
      expect(corpus.meta.wordCount).toBe(c.wordCount);
      expect(corpus.connections).toHaveLength(c.ayahCount - 1);
      expect(corpus.meta.distractorsAuthored).toBe(c.hasAuthoredExtras);
      expect(corpus.meta.hasMentalModel).toBe(c.hasAuthoredExtras);

      // no hard check failed for any surah, degenerate or not
      const hardFails = report.checks.filter((chk) => chk.severity === "hard" && !chk.pass);
      expect(hardFails).toEqual([]);
    });
  }

  it("surah 12 has authored distractors; 103 and 112 correctly have none yet", () => {
    const yusuf = buildFromInputs(loadInputs(12));
    const alAsr = buildFromInputs(loadInputs(103));
    const ikhlas = buildFromInputs(loadInputs(112));
    expect(yusuf.distractors.length).toBeGreaterThan(0);
    expect(alAsr.distractors).toEqual([]);
    expect(ikhlas.distractors).toEqual([]);
  });
});
