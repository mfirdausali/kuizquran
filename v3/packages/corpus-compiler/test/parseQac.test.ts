// Asserts word/ayah COUNTS per surah from the vendored QAC file — never
// reads or asserts on the Arabic text itself (v3/INVARIANTS.md Absolute B).

import { describe, expect, it } from "vitest";
import { parseQac } from "../src/parseQac.ts";
import { QAC_PATH } from "../src/io.ts";

describe("parseQac — per-surah morphology (build-plan step 3 generalization)", () => {
  const qac = parseQac(QAC_PATH);

  it("keys morphology by surah, not just a single hardcoded surah", () => {
    expect(qac.morphBySurah.has(12)).toBe(true);
    expect(qac.morphBySurah.has(103)).toBe(true);
    expect(qac.morphBySurah.has(112)).toBe(true);
  });

  it("surah 12 (Yusuf) has 1777 words across 111 ayat", () => {
    const morph = qac.morphBySurah.get(12)!;
    expect(morph.size).toBe(1777);
    const ayat = new Set([...morph.keys()].map((k) => k.split(":")[0]));
    expect(ayat.size).toBe(111);
  });

  it("surah 103 (Al-Asr) has 14 words across 3 ayat", () => {
    const morph = qac.morphBySurah.get(103)!;
    expect(morph.size).toBe(14);
    const ayat = new Set([...morph.keys()].map((k) => k.split(":")[0]));
    expect(ayat.size).toBe(3);
  });

  it("surah 112 (Al-Ikhlas) has 15 words across 4 ayat", () => {
    const morph = qac.morphBySurah.get(112)!;
    expect(morph.size).toBe(15);
    const ayat = new Set([...morph.keys()].map((k) => k.split(":")[0]));
    expect(ayat.size).toBe(4);
  });

  it("every word's morphology has a POS class (hard floor v1 relied on)", () => {
    for (const surah of [12, 103, 112]) {
      const morph = qac.morphBySurah.get(surah)!;
      for (const [key, m] of morph) {
        expect(m.class, `surah ${surah} word ${key} missing class`).not.toBeNull();
      }
    }
  });
});
