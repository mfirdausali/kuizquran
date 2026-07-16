import { describe, expect, it } from "vitest";
import { YUSUF_MOVEMENTS, movementsFor, movementForAyah } from "./movements.ts";

describe("Yusuf's 12-movement ring (v2-D24)", () => {
  it("tiles all 111 ayat with no gaps or overlaps", () => {
    const sorted = [...YUSUF_MOVEMENTS].sort((a, b) => a.ayahFrom - b.ayahFrom);
    expect(sorted[0]!.ayahFrom).toBe(1);
    expect(sorted[sorted.length - 1]!.ayahTo).toBe(111);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.ayahFrom).toBe(sorted[i - 1]!.ayahTo + 1);
    }
  });

  it("mirror pairs are symmetric", () => {
    for (const m of YUSUF_MOVEMENTS) {
      const mirror = YUSUF_MOVEMENTS.find((x) => x.id === m.mirrorOf)!;
      expect(mirror.mirrorOf).toBe(m.id);
    }
  });

  it("movementForAyah finds the right movement", () => {
    expect(movementForAyah(12, 1)?.id).toBe(1);
    expect(movementForAyah(12, 51)?.id).toBe(9);
    expect(movementForAyah(12, 111)?.id).toBe(12);
  });

  it("no map for a surah without one — v2-D29 flat-grid fallback", () => {
    expect(movementsFor(99)).toBeNull();
    expect(movementForAyah(99, 1)).toBeNull();
  });
});
