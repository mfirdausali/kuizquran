// Structural tests for the ROUTE TREE and the APP SHELL (build-plan step 17).
//
// WHY THESE ARE FILE-LEVEL ASSERTIONS RATHER THAN RENDER TESTS. There is no
// DOM test environment installed (vitest runs `environment: "node"`, and there
// is no @testing-library/react). Adding one is a LOCKFILE change, and
// BUILD-PLAN reserves lockfile changes to the spine lane — so this step does
// not take one. Rendering assertions arrive with the Playwright e2e suite that
// M5 already schedules.
//
// What is asserted here is therefore deliberately narrow: the handful of
// structural facts that a well-meaning later edit could break SILENTLY, where
// "silently" means the build stays green and the app looks fine.
//
//   - the stylesheet import ORDER (locked file first, ext layer second). Swap
//     the two lines and the whole design system inverts with no gate firing:
//     check-locked-css.mjs would still find the locked file byte-identical.
//   - every route the tab bar points at EXISTS. A tab that 404s is worse than
//     a missing tab.
//   - PLAN is a tab and "You" is not (v3-D05).
//   - "/" is outside the (app) group — the landing page must not sprout
//     learner navigation (v3-D14).
//   - no page.tsx under app/ imports lib/idb without "use client" (edge case
//     #72). check-boundaries.mjs owns this too; asserting it here as well
//     means a regression fails `npm test` and not only `npm run build`.
//   - the 44px floor (edge case #82) lives in the EXT layer, never the locked
//     file.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(path.join(WEB, rel), "utf8");
const has = (rel: string) => existsSync(path.join(WEB, rel));

/**
 * Strip comments so an assertion inspects CODE, not prose ABOUT the code.
 *
 * The same construction check-boundaries.mjs uses for its clauses 3 and 5, and
 * for the same reason: these files DOCUMENT the very rules being asserted, so
 * a naive substring match fires on the explanation of the rule rather than on
 * a violation of it. Three of these tests failed exactly that way on their
 * first run — "NOT next/font", "typing !important", and an `id="main"` named
 * in a comment above the markup. A check that cannot tell a rule from its
 * description trains people to delete the check.
 */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Every route this step is required to ship, and the file that serves it. */
const ROUTES: ReadonlyArray<readonly [route: string, file: string]> = [
  ["/", "app/page.tsx"],
  ["/home", "app/(app)/home/page.tsx"],
  ["/library", "app/(app)/library/page.tsx"],
  ["/surah/[surah]", "app/(app)/surah/[surah]/page.tsx"],
  ["/surah/[surah]/[ayah]", "app/(app)/surah/[surah]/[ayah]/page.tsx"],
  ["/session", "app/(app)/session/page.tsx"],
  ["/progress", "app/(app)/progress/page.tsx"],
  ["/progress/list", "app/(app)/progress/list/page.tsx"],
  ["/plan", "app/(app)/plan/page.tsx"],
];

describe("the route tree", () => {
  it.each(ROUTES)("%s is served by a real file", (_route, file) => {
    expect(has(file)).toBe(true);
  });

  it.each(ROUTES)("%s is not an empty stub file", (_route, file) => {
    const src = read(file);
    // A real page: a default export, a heading, and enough content that
    // "it exists" and "it renders something" are the same claim.
    expect(src).toMatch(/export default (async )?function/);
    // `<h1` and not `<h1>`: a top-level heading carrying a class or an id is
    // still a top-level heading. The bare-tag form silently failed the moment
    // the landing page's h1 took a class (build-plan step 29) — and it would
    // have failed for a styled h1 on any other route too. The assertion's
    // intent is "this page has a real top-level heading", which is what it now
    // checks; nothing is weakened, because a page with NO h1 still fails.
    expect(src).toMatch(/<h1[\s>]/);
    expect(src.length).toBeGreaterThan(400);
  });

  it("every route that is not this step's work names the step that owns it", () => {
    // A stub that does not say what it is waiting for reads as finished.
    const stubs = ROUTES.map(([, f]) => f).filter((f) => read(f).includes("StubNote"));
    expect(stubs.length).toBeGreaterThan(0);
    for (const f of stubs) {
      const src = read(f);
      // Either the TODO comment or the rendered note must name a build-plan step.
      expect(src).toMatch(/build-plan step \d+|step="step \d+/i);
    }
  });

  it("has a real 404 page rather than the framework default", () => {
    expect(has("app/not-found.tsx")).toBe(true);
  });
});

describe("the root layout", () => {
  const layout = code(read("app/layout.tsx"));

  it("imports the LOCKED stylesheet before the EXTENSION layer", () => {
    const locked = layout.indexOf('import "./iman-ui.css"');
    const ext = layout.indexOf('import "./iman-ext.css"');
    expect(locked).toBeGreaterThan(-1);
    expect(ext).toBeGreaterThan(-1);
    // The ext layer wins ties by CASCADE ORDER, which is the reason it never
    // needs `!important`. Reversing these two lines is invisible to every
    // gate — the locked file is still byte-identical — and inverts the system.
    expect(locked).toBeLessThan(ext);
  });

  it("does not use next/font (its hashed families cannot match locked tokens)", () => {
    expect(layout).not.toMatch(/next\/font/);
  });

  it("keeps UI chrome LTR — Arabic is an island, not the document", () => {
    expect(layout).toMatch(/<html lang="en" dir="ltr">/);
  });

  it("never blocks pinch-zoom (WCAG 1.4.4)", () => {
    expect(layout).not.toMatch(/maximumScale|userScalable/);
  });

  it("does not import lib/idb — a layout read would risk edge case #72", () => {
    expect(layout).not.toMatch(/from\s+["'][^"']*lib\/idb/);
  });
});

describe("the app shell", () => {
  const tabbar = code(read("components/shell/TabBar.tsx"));
  const shell = code(read("app/(app)/layout.tsx"));

  it("puts the tab bar inside the (app) group, not at the root", () => {
    // "/" is the landing page (v3-D14) and must show no learner navigation.
    expect(code(read("app/layout.tsx"))).not.toMatch(/TabBar/);
    expect(shell).toMatch(/TabBar/);
  });

  it("ships PLAN as a tab and no 'You' tab (v3-D05)", () => {
    expect(tabbar).toMatch(/href: "\/plan"/);
    expect(tabbar).not.toMatch(/label: "You"/);
  });

  it("points every tab at a route that exists", () => {
    const hrefs = [...tabbar.matchAll(/href: "([^"]+)"/g)].map((m) => m[1]!);
    expect(hrefs.length).toBe(4);
    for (const href of hrefs) {
      const served = ROUTES.some(([route]) => route === href);
      expect(served, `tab ${href} has no page file`).toBe(true);
    }
  });

  it("uses real Links, not click handlers", () => {
    expect(tabbar).toMatch(/from "next\/link"/);
    expect(tabbar).not.toMatch(/onClick/);
  });

  it("marks the current tab with aria-current, not colour alone", () => {
    expect(tabbar).toMatch(/aria-current=\{current \? "page" : undefined\}/);
  });

  it("gives the shell a skip link as its first focusable element", () => {
    expect(shell).toMatch(/skip-link/);
    expect(shell).toMatch(/href="#main"/);
    expect(shell).toMatch(/id="main"/);
    // It must precede <main> in the DOM or "skip to content" means nothing.
    expect(shell.indexOf("skip-link")).toBeLessThan(shell.indexOf('id="main"'));
  });
});

describe("the extension layer", () => {
  /** The raw file — for assertions ABOUT its documentation. */
  const extRaw = read("app/iman-ext.css");
  /** Rules only — for assertions about what it DOES. */
  const ext = code(extRaw);
  const locked = code(read("app/iman-ui.css"));

  it("documents why the locked file is not the place for new rules", () => {
    expect(extRaw).toMatch(/LOCKED/);
    expect(extRaw).toMatch(/check-locked-css/);
  });

  it("supplies the 44px tap floor here, never in the locked file", () => {
    // Edge case #82: "44px targets vs locked ~32px .tile — transparent
    // .tile-hit wrapper in ext layer; locked file CI byte-diffed."
    expect(ext).toMatch(/--tap-min:\s*44px/);
    expect(ext).toMatch(/\.tile-hit\s*\{/);
    expect(locked).not.toMatch(/tile-hit/);
    expect(locked).not.toMatch(/44px/);
  });

  it("does not redefine a locked token's value", () => {
    // Extending is allowed; re-colouring the system from the ext layer is not.
    for (const token of ["--teal-600", "--coral-500", "--surface-0", "--font-arabic"]) {
      expect(ext, `${token} redefined in the ext layer`).not.toMatch(
        new RegExp(`${token}\\s*:`),
      );
    }
  });

  it("wins by cascade order, never by !important", () => {
    expect(ext).not.toMatch(/!important/);
  });

  it("does not restate prefers-reduced-motion — the locked file already does", () => {
    expect(locked).toMatch(/prefers-reduced-motion/);
    // A weaker duplicate invites someone to "fix" the strong rule.
    expect(ext).not.toMatch(/@media\s*\(prefers-reduced-motion/);
  });
});

describe("client-side steering (edge cases #92 / #71)", () => {
  const steerRaw = read("components/shell/OnboardedSteer.tsx");
  const steer = code(steerRaw);

  it("is a client island — a service worker bypasses middleware", () => {
    expect(steerRaw.split("\n")[0]).toMatch(/^"use client"/);
  });

  it("is mounted on the landing page, where the bypass lands the learner", () => {
    expect(code(read("app/page.tsx"))).toMatch(/<OnboardedSteer \/>/);
  });

  it("treats IndexedDB as truth and never decides from a cookie", () => {
    // v3-D14: ITP caps script-written cookies at 7 days, so a cookie may only
    // make the redirect faster — never decide that it happens.
    expect(steer).toMatch(/onboardedAt/);
    expect(steer).not.toMatch(/document\.cookie/);
  });

  it("replaces rather than pushes, so Back does not bounce off the landing page", () => {
    expect(steer).toMatch(/router\.replace/);
    expect(steer).not.toMatch(/router\.push/);
  });

  it("stays put when IndexedDB is unreadable rather than guessing", () => {
    // Sending a learner to a dashboard we cannot confirm is theirs is worse
    // than leaving a visitor on the page they asked for.
    expect(steer).toMatch(/catch/);
  });
});

describe("the corpus/log boundary in the route tree (edge case #72)", () => {
  it("no page or layout under app/ imports lib/idb without \"use client\"", () => {
    for (const [, file] of ROUTES) {
      const src = read(file);
      if (/from\s+["'][^"']*lib\/idb/.test(code(src))) {
        expect(src.split("\n").slice(0, 5).join("\n"), file).toMatch(/^\s*"use client"/m);
      }
    }
    expect(code(read("app/(app)/layout.tsx"))).not.toMatch(/from\s+["'][^"']*lib\/idb/);
  });

  it("the dashboard's log-derived line is an exhaustively-stated client island, and is actually rendered on /home", () => {
    // v3-D146: this test used to inspect components/home/LogSummary.tsx — a
    // real, exhaustively-stated island that satisfied every assertion below
    // and was nonetheless dead code. `TodaySession` (build-plan step
    // 18/19/v3-D74) superseded it as the dashboard's real log-derived line,
    // but nothing ever repointed this test, so it kept passing against a file
    // no route imports — a shape check with no wiring check is exactly the
    // "tests pass, the wiring is not proven" shape this codebase has caught
    // repeatedly elsewhere (B6's mutation survivor, v3-D83's gradeClassToWire
    // finding). `LogSummary.tsx` is deleted; this test both re-verifies the
    // discipline against the REAL live file and proves it is the one /home
    // actually renders, so a future supersession cannot silently repeat this.
    const raw = read("components/home/TodaySession.tsx");
    const island = code(raw);
    expect(raw.split("\n")[0]).toMatch(/^"use client"/);
    // Every State case. A missing one is already a type error under strict;
    // this asserts the SHAPE so a later refactor to `if (data)` — which
    // type-checks and reintroduces edge case #73 — fails a test too.
    for (const status of ["loading", "not-enrolled", "unavailable", "broken", "ready"]) {
      expect(island, `case "${status}" missing`).toMatch(
        new RegExp(`case "${status}"`),
      );
    }
    // Skeletons are never zeros: the loading branch paints .skel, not a digit.
    expect(island).toMatch(/className="skel"/);
    // The wiring itself: not merely well-shaped, but the file /home renders.
    expect(code(read("app/(app)/home/page.tsx"))).toMatch(/<TodaySession\b/);
  });

  it("has no dead client island left behind by a supersession", () => {
    // The concrete regression this guards: a component fully superseded by
    // another (TodaySession replaced LogSummary, v3-D146) left on disk,
    // unimported, with its own test still asserting on its source text.
    expect(has("components/home/LogSummary.tsx")).toBe(false);
  });
});
