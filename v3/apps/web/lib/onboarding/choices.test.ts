/**
 * @vitest-environment jsdom
 */

// `commitOnboarding`'s own real-enrollment half (IDB) already has real
// callers across several other test files; this file covers the ONE thing
// that was missing — the enrolled-surah cookie hint
// (lib/enrollment/surahCookie.ts) that lets a Server Component pick the
// learner's REAL surah before any client island mounts (v3-D301/v3-D302
// finding B). RED first: against the unmodified `commitOnboarding`, the
// cookie this test reads back was never written at all.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commitOnboarding } from "./choices.ts";
import { resetDbForTests } from "@/lib/idb";
import { ENROLLED_SURAH_COOKIE } from "@/lib/enrollment/surahCookie.ts";

function clearCookies() {
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  }
}

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? match[1] : undefined;
}

beforeEach(async () => {
  clearCookies();
  await resetDbForTests();
});
afterEach(clearCookies);

describe("commitOnboarding", () => {
  it("writes the enrolled-surah cookie hint alongside the IDB commit", async () => {
    await commitOnboarding(
      { glossLang: "en", surah: 103, pace: "steady", placement: { kind: "skipped" } },
      1_000,
    );
    expect(readCookie(ENROLLED_SURAH_COOKIE)).toBe("103");
  });

  it("mirrors the CHOSEN surah, not a hardcoded default", async () => {
    // Two different choices must produce two different cookie values — a
    // fix that always wrote "12" would satisfy a weaker assertion and
    // reproduce the exact defect this test exists to catch.
    await commitOnboarding(
      { glossLang: "en", surah: 112, pace: "sprint", placement: { kind: "fresh" } },
      2_000,
    );
    expect(readCookie(ENROLLED_SURAH_COOKIE)).toBe("112");
  });
});
