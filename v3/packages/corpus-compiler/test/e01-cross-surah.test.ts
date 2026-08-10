// The hard blocker build-plan step 3 names: "E-01 surah-keying must land
// before any second-surah artifact exists". This test compiles TWO real
// surahs (12 and 103, both vendored — see data/raw/README.md) and asserts
// their atom-shaped keys never collide, even though both surahs have an
// ayah 1, 2 and 3. Only structural coordinates are asserted — never the
// Arabic text itself (v3/INVARIANTS.md Absolute B).

import { describe, expect, it } from "vitest";
import { loadInputs, buildFromInputs } from "../src/io.ts";

describe("cross-surah atom-key non-collision (v3/DEFECTS.md#E-01)", () => {
  const yusuf = buildFromInputs(loadInputs(12));
  const alAsr = buildFromInputs(loadInputs(103));

  it("both surahs have an ayah 1, 2 and 3 — the exact collision scenario", () => {
    const yusufAyat = new Set(yusuf.verses.map((v) => v.ayah));
    const alAsrAyat = new Set(alAsr.verses.map((v) => v.ayah));
    for (const ayah of [1, 2, 3]) {
      expect(yusufAyat.has(ayah)).toBe(true);
      expect(alAsrAyat.has(ayah)).toBe(true);
    }
  });

  it("verse atom keys (surah:ayah) never collide across the two surahs", () => {
    const key = (surah: number, ayah: number) => `${surah}:${ayah}`;
    const yusufKeys = new Set(yusuf.verses.map((v) => key(v.surah, v.ayah)));
    const alAsrKeys = new Set(alAsr.verses.map((v) => key(v.surah, v.ayah)));
    for (const k of alAsrKeys) expect(yusufKeys.has(k)).toBe(false);
  });

  it("connection atom keys (surah:from:to) never collide", () => {
    const key = (c: { surah: number; from: number; to: number }) => `${c.surah}:${c.from}:${c.to}`;
    const yusufKeys = new Set(yusuf.connections.map(key));
    const alAsrKeys = new Set(alAsr.connections.map(key));
    // Al-Asr's 1->2 connection exists in both surahs by ayah number alone —
    // the surah field is what must keep them apart.
    expect(alAsrKeys.has("103:1:2")).toBe(true);
    expect(yusufKeys.has("12:1:2")).toBe(true);
    for (const k of alAsrKeys) expect(yusufKeys.has(k)).toBe(false);
  });

  it("word atom keys (surah:ayah:position) never collide", () => {
    const key = (surah: number, ayah: number, position: number) => `${surah}:${ayah}:${position}`;
    const yusufKeys = new Set(yusuf.words.map((w) => key(w.surah, w.ayah, w.position)));
    const alAsrKeys = new Set(alAsr.words.map((w) => key(w.surah, w.ayah, w.position)));
    for (const k of alAsrKeys) expect(yusufKeys.has(k)).toBe(false);
  });

  it("meta.surah is correct and distinct for each compiled artifact", () => {
    expect(yusuf.meta.surah).toBe(12);
    expect(alAsr.meta.surah).toBe(103);
  });
});
