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

  // Superseded by foil kernels (NIGHTLY.md "Distractors — decided", closing
  // D51). This test previously asserted `alAsr.distractors` and
  // `ikhlas.distractors` were EMPTY — that was a statement of the defect, not
  // of intent: with zero distractors every reconstruct blank in 103/112 offered
  // a tile bank containing only the correct answer. The assertion is now
  // STRENGTHENED, not weakened: the surahs must be non-empty AND wholly
  // kernel-origin, while surah 12 stays authored-only (the override layer).
  it("surah 12 stays authored-only; 103 and 112 are now filled by the foil kernels", () => {
    const yusuf = buildFromInputs(loadInputs(12));
    const alAsr = buildFromInputs(loadInputs(103));
    const ikhlas = buildFromInputs(loadInputs(112));

    expect(yusuf.distractors.length).toBeGreaterThan(0);
    expect(yusuf.meta.distractorOrigin.kernel).toBe(0);

    for (const c of [alAsr, ikhlas]) {
      expect(c.distractors.length).toBeGreaterThan(0);
      expect(c.meta.distractorOrigin.authored).toBe(0);
      expect(c.distractors.every((d) => d.origin === "kernel")).toBe(true);
      // every word is genuinely covered at the Learn band's rank window
      for (const w of c.words) {
        const atRank4 = c.distractors.filter(
          (d) => d.ayah === w.ayah && d.position === w.position && d.rank <= 4,
        );
        expect(atRank4.length).toBeGreaterThanOrEqual(4);
      }
    }
  });
});
