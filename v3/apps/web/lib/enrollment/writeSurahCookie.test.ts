/**
 * @vitest-environment jsdom
 */

// `document.cookie` only exists with a DOM, so this file opts into jsdom —
// the default `node` environment (vitest.config.ts) has no `document` at
// all, which `writeEnrolledSurahCookie` must survive (and does, via its own
// try/catch) for every OTHER caller that runs in the plain `node`
// environment, e.g. `lib/session/run.test.ts`'s `commitOnboarding` calls.

import { afterEach, describe, expect, it } from "vitest";
import { writeEnrolledSurahCookie } from "./writeSurahCookie.ts";
import { ENROLLED_SURAH_COOKIE } from "./surahCookie.ts";

function clearCookies() {
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  }
}

afterEach(clearCookies);

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? match[1] : undefined;
}

describe("writeEnrolledSurahCookie", () => {
  it("writes the surah under the real cookie name", () => {
    writeEnrolledSurahCookie(67);
    expect(readCookie(ENROLLED_SURAH_COOKIE)).toBe("67");
  });

  it("overwrites a previously written value rather than appending a second cookie", () => {
    writeEnrolledSurahCookie(12);
    writeEnrolledSurahCookie(103);
    expect(readCookie(ENROLLED_SURAH_COOKIE)).toBe("103");
  });

  it("never throws, even if document.cookie itself throws", () => {
    // Defined on the INSTANCE (`document`), which shadows `Document
    // .prototype`'s own accessor — so it must also be removed from the
    // instance, not "restored" onto the prototype it never touched.
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get() {
        throw new Error("cookies disabled");
      },
      set() {
        throw new Error("cookies disabled");
      },
    });
    try {
      expect(() => writeEnrolledSurahCookie(112)).not.toThrow();
    } finally {
      Reflect.deleteProperty(document, "cookie");
    }
  });
});
