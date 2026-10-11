// `/plan`, `/progress` and `/progress/list` are Server Components — none can
// be mounted with `render()` (they are `async function`s reading
// `cookies()`, which only resolves inside a real Next.js request), so this
// mirrors `test/request-time-clock.test.ts`'s own established technique: a
// source-text proof that the real wiring is in place, rather than a stub
// that merely asserts the shared `resolveSurah` behaves correctly in
// isolation (already covered, independently, by
// `lib/enrollment/surahCookie.test.ts`).
//
// THE DEFECT THIS GUARDS (v3-D301/v3-D302 finding B): all three pages
// defaulted silently to `AVAILABLE_SURAHS[0]` (12/Yusuf) whenever no
// `?surah=` query param was present — which was every real visit, since
// nothing in the app links to any of them with one. A learner enrolled in
// 103, 67 or 112 saw "Nothing recorded yet" on /plan and /progress even
// after a real completed session.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "..");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

function read(relPath: string): string {
  return stripComments(readFileSync(join(WEB, relPath), "utf8"));
}

const PAGES = [
  join("app", "(app)", "plan", "page.tsx"),
  join("app", "(app)", "progress", "page.tsx"),
  join("app", "(app)", "progress", "list", "page.tsx"),
] as const;

describe("/plan, /progress and /progress/list pick the learner's real enrolled surah", () => {
  for (const page of PAGES) {
    describe(page, () => {
      const src = read(page);

      it("reads the enrolled-surah cookie hint, not just the build default", () => {
        expect(src).toMatch(/\bcookies\s*\(\s*\)/);
        expect(src).toMatch(/ENROLLED_SURAH_COOKIE/);
      });

      it("resolves the surah through the shared resolver, never re-deriving it inline", () => {
        // A second, locally re-derived copy of this decision is exactly the
        // shape this build has repeatedly closed elsewhere.
        expect(src).toMatch(/\bresolveSurah\s*\(/);
        expect(src).toMatch(/from\s*["']@\/lib\/enrollment\/surahCookie["']/);
      });

      it("no longer defaults unconditionally to AVAILABLE_SURAHS[0]", () => {
        // The ONE legitimate remaining use of AVAILABLE_SURAHS[0] is inside
        // resolveSurah's own fallback (a different file); these pages must
        // not ALSO hardcode it as their own first/only choice.
        expect(src).not.toMatch(/=\s*AVAILABLE_SURAHS\[0\]/);
      });
    });
  }

  it("all three pages import the SAME resolver — the shared-decision guarantee", () => {
    // If any page re-declared its own parseSurah/resolveSurah instead of
    // importing the shared one, the three could silently disagree about
    // what "this surah" means again — precisely the bug the shared module
    // exists to foreclose.
    for (const page of PAGES) {
      expect(read(page)).toMatch(/from\s*["']@\/lib\/enrollment\/surahCookie["']/);
    }
  });
});
