// `resolveSurah` is the one place "which surah does this server page load"
// is decided — see surahCookie.ts's own header for why (v3-D301/v3-D302's
// finding B). RED first: this module did not exist before this fix, so
// every one of these failed on import resolution against the unmodified
// tree.

import { describe, expect, it } from "vitest";
import { ENROLLED_SURAH_COOKIE, resolveSurah } from "./surahCookie.ts";

const AVAILABLE = [12, 67, 103, 112] as const;

describe("resolveSurah", () => {
  it("prefers an explicit query param over the cookie hint", () => {
    expect(resolveSurah("67", "103", AVAILABLE)).toBe(67);
  });

  it("falls back to the cookie hint when no query param is present", () => {
    expect(resolveSurah(undefined, "103", AVAILABLE)).toBe(103);
  });

  it("falls back to the build default when neither is present", () => {
    expect(resolveSurah(undefined, undefined, AVAILABLE)).toBe(12);
  });

  it("ignores a query param naming a surah nothing is compiled for", () => {
    // A surah outside the launch set must not silently become "this
    // learner's corpus" just because it appeared in a URL.
    expect(resolveSurah("999", "103", AVAILABLE)).toBe(103);
  });

  it("ignores a cookie naming a surah nothing is compiled for", () => {
    expect(resolveSurah(undefined, "999", AVAILABLE)).toBe(12);
  });

  it("ignores a non-numeric query param", () => {
    expect(resolveSurah("abc", "103", AVAILABLE)).toBe(103);
  });

  it("ignores a non-numeric cookie value", () => {
    expect(resolveSurah(undefined, "abc", AVAILABLE)).toBe(12);
  });

  it("names the real cookie everything else must agree on", () => {
    // A second, independently-spelled cookie name in a page or the writer
    // would silently never be read back — the same "two implementations
    // of one decision" shape this build has repeatedly closed elsewhere.
    expect(ENROLLED_SURAH_COOKIE).toBe("enrolledSurah");
  });
});
