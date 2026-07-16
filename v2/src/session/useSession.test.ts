import { describe, expect, it } from "vitest";
import { learnWindowStart } from "./useSession.ts";

describe("learnWindowStart (ROADMAP Phase 3 placement-start fallback)", () => {
  it("continues from the highest encoded ayah + 1, ignoring placement", () => {
    expect(learnWindowStart(10, 3, 111)).toBe(11);
  });

  it("before anything's encoded, falls back to the placement start ayah", () => {
    expect(learnWindowStart(0, 19, 111)).toBe(19);
  });

  it("before anything's encoded and no placement cached, falls back to ayah 1", () => {
    expect(learnWindowStart(0, null, 111)).toBe(1);
  });

  it("clips to the surah's ayah count", () => {
    expect(learnWindowStart(0, 500, 111)).toBe(111);
    expect(learnWindowStart(200, 3, 111)).toBe(111);
  });

  it("never goes below ayah 1", () => {
    expect(learnWindowStart(0, 0, 111)).toBe(1);
  });
});
