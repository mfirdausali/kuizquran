/**
 * @vitest-environment jsdom
 */

// EnrollmentSteer — the missing SECOND caller `writeSurahCookie.ts`'s own
// docblock has named by file path since v3-D303: "mirrored by two callers:
// `lib/onboarding/choices.ts#commitOnboarding` ... and
// `components/shell/EnrollmentSteer.tsx` (self-healing a device that
// onboarded before this cookie existed)." `surahCookie.ts`'s own header
// makes the identical promise. Neither was ever true —
// `grep -rln "EnrollmentSteer" apps/web` returned only those two docblock
// mentions before this fix; `commitOnboarding` writes the enrolled-surah
// cookie exactly ONCE, at onboarding, and nothing ever refreshed it.
//
// WHY THIS IS A REAL GAP, NOT A COSMETIC ONE. Safari's ITP caps a
// script-written cookie's real lifetime at 7 days regardless of the
// declared `max-age` (both files' own headers already say so) — and a
// spaced-repetition app's whole premise is reviews spaced days-to-weeks
// apart, so a learner who does not open the app for a week is the ORDINARY
// case. Once the cookie expires, every Server Component that resolves a
// surah before its first client island mounts (`/plan`, `/progress`,
// `/progress/list`, `/drill`, `/practice`) falls back to
// `AVAILABLE_SURAHS[0]` — exactly the "/plan shows the wrong surah" failure
// v3-D301/D303/D310 each believed they had closed for good, reopened by
// nothing more than a week of ordinary use.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { DB_NAME, openDb, resetDbForTests } from "@/lib/idb";
import { commitOnboarding } from "@/lib/onboarding/choices";
import { ENROLLED_SURAH_COOKIE } from "@/lib/enrollment/surahCookie.ts";
import { EnrollmentSteer } from "@/components/shell/EnrollmentSteer";

afterEach(cleanup);

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
  try {
    const db = await openDb();
    db.close();
  } catch {
    // No database yet on the first test.
  }
  resetDbForTests();
  await new Promise<void>((done) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => done();
    req.onerror = () => done();
    req.onblocked = () => done();
  });
  clearCookies();
});

afterEach(clearCookies);

const NOW = Date.UTC(2026, 9, 13, 9, 0, 0);

describe("EnrollmentSteer — refreshes the cookie writeSurahCookie.ts already promised it would", () => {
  it("writes the real enrolled surah when a device has already onboarded", async () => {
    await commitOnboarding(
      { glossLang: "en", surah: 67, pace: "steady", placement: { kind: "fresh" } },
      NOW,
    );
    // The cookie is already there from `commitOnboarding` itself — clear it
    // first, so a pass here can only be the STEER writing it again, not a
    // leftover from the write this component is supposed to be refreshing.
    clearCookies();
    expect(readCookie(ENROLLED_SURAH_COOKIE)).toBeUndefined();

    render(<EnrollmentSteer />);

    await waitFor(() => expect(readCookie(ENROLLED_SURAH_COOKIE)).toBe("67"));
  });

  it("writes nothing, and never throws, on a device that has never onboarded", async () => {
    expect(() => render(<EnrollmentSteer />)).not.toThrow();
    // Give the effect a tick to run; there is no cookie to wait FOR, so wait
    // for the real async read to resolve instead.
    await new Promise((r) => setTimeout(r, 0));
    expect(readCookie(ENROLLED_SURAH_COOKIE)).toBeUndefined();
  });

  it("is a client island, mounted in the app shell every real page renders under", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const HERE = dirname(fileURLToPath(import.meta.url));
    const steerRaw = readFileSync(join(HERE, "../components/shell/EnrollmentSteer.tsx"), "utf8");
    expect(steerRaw.split("\n")[0]).toMatch(/^"use client"/);

    const shellRaw = readFileSync(join(HERE, "../app/(app)/layout.tsx"), "utf8");
    expect(shellRaw).toMatch(/<EnrollmentSteer\s*\/>/);
  });
});
