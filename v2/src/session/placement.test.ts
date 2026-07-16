import { beforeEach, describe, expect, it } from "vitest";
import { loadPlacement, savePlacement, clearPlacement } from "./placement.ts";

beforeEach(() => localStorage.clear());

describe("placement cache (feeds useSession's learn-window fallback)", () => {
  it("returns null when nothing stored", () => {
    expect(loadPlacement()).toBeNull();
  });

  it("round-trips the carried map + start ayah + daily plan", () => {
    savePlacement({ carriedAyat: [1, 2, 3, 4, 5, 6], startAyah: 7, ayahPerDay: 1 });
    expect(loadPlacement()).toEqual({ carriedAyat: [1, 2, 3, 4, 5, 6], startAyah: 7, ayahPerDay: 1 });
  });

  it("clears back to null", () => {
    savePlacement({ carriedAyat: [], startAyah: 1, ayahPerDay: 1 });
    clearPlacement();
    expect(loadPlacement()).toBeNull();
  });
});
