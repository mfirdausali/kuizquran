/**
 * @vitest-environment jsdom
 */

// THE ATTRIBUTION PAGE (build-plan step 30 / M10, v3-D24).
//
// ---------------------------------------------------------------------------
// WHAT THESE TESTS PROTECT
// ---------------------------------------------------------------------------
// This is a legal page. The failure mode is not "it looks wrong" — it is "it
// makes a false statement about someone else's work", or "the obligation was
// silently dropped because nobody could reach the page". So:
//
//   - the two REQUIRED sources are named, with their licences, and the QAC row
//     specifically says GPL — the fact that makes the page necessary;
//   - the page is REACHABLE from the landing footer, because an attribution
//     page nobody links to discharges nothing;
//   - the page makes no endorsement claim, which would be a false statement
//     about a project that has never heard of this product;
//   - the licence strings match what was actually vendored, asserted against
//     the source-of-truth text rather than against themselves.
//
// Not one Arabic byte is typed here — this page renders no Quranic text at all,
// which is itself asserted below.

import { cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import AttributionPage from "@/app/attribution/page";
import {
  BOUNDARIES,
  FONTS,
  SOURCES,
  attributionStrings,
} from "@/lib/legal/attribution";

// Each `render` mounts into the same document; without this the second test
// sees the first test's tables too (12 tables instead of 2).
afterEach(cleanup);

const here = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(here, "..");

describe("the attribution page names every source it is obliged to name", () => {
  it("names the Quranic Arabic Corpus and states its GPL licence", () => {
    render(<AttributionPage />);

    const qac = SOURCES.find((s) => /Quranic Arabic Corpus/.test(s.name));
    expect(qac, "the QAC row is the reason this page exists").toBeDefined();

    // The row, as a screen reader reaches it: a row header naming the source.
    const row = screen.getByRole("rowheader", { name: new RegExp(qac!.name) });
    expect(row).toBeTruthy();

    // GPL is the load-bearing fact. v3-D24: "GPL exposure in a paid bundle is
    // real." A page that named the corpus but not its licence would satisfy a
    // "mentions QAC" check while discharging nothing.
    expect(qac!.licence).toMatch(/GNU General Public License/);
    expect(screen.getAllByText(/GNU General Public License/).length).toBeGreaterThan(0);
  });

  it("names the Tanzil Project as the source of the text and its numbering", () => {
    render(<AttributionPage />);

    const tanzil = SOURCES.find((s) => /Tanzil/.test(s.name));
    expect(tanzil).toBeDefined();
    expect(screen.getByRole("rowheader", { name: /Tanzil/ })).toBeTruthy();

    // The numbering claim matters: BUILD-PLAN edge case #13 pins Tanzil
    // numbering, and the page should say what was actually relied on.
    expect(tanzil!.used).toMatch(/numbering/i);
  });

  it("names the Amiri typeface and its OFL licence", () => {
    render(<AttributionPage />);

    const amiri = FONTS.find((f) => /Amiri/.test(f.name));
    expect(amiri).toBeDefined();
    expect(amiri!.licence).toMatch(/SIL Open Font License/);
    expect(screen.getByRole("rowheader", { name: /Amiri/ })).toBeTruthy();
  });

  /**
   * THE ANTI-SELF-GRADING ASSERTION.
   *
   * Every test above compares the page against `attribution.ts` — so a typo in
   * that file would be reproduced faithfully by the page AND asserted happily
   * by the tests. That is a closed loop.
   *
   * `v1/data/raw/SOURCES.md` is the record of what was ACTUALLY VENDORED, from
   * where, under what licence. Checking the page's claims against it is what
   * makes them verifiable rather than merely internally consistent.
   */
  it("agrees with the vendored SOURCES.md rather than only with itself", () => {
    const sourcesMd = readFileSync(
      join(WEB_ROOT, "../../../v1/data/raw/SOURCES.md"),
      "utf8",
    );

    // The licence claim on the page must be the licence the vendoring recorded.
    expect(sourcesMd).toMatch(/GNU General Public License/);
    expect(sourcesMd).toMatch(/Quranic Arabic Corpus/);
    expect(sourcesMd).toMatch(/Tanzil/);

    // And the attribution names Kais Dukes, whom SOURCES.md credits.
    const qac = SOURCES.find((s) => /Quranic Arabic Corpus/.test(s.name))!;
    expect(sourcesMd).toContain("Kais Dukes");
    expect(qac.credit).toMatch(/Kais Dukes/);
  });
});

describe("the page is reachable and makes no claim it should not", () => {
  /**
   * An attribution page that exists but is linked from nowhere discharges no
   * obligation. The landing footer is the one surface every visitor sees.
   *
   * Asserted as a SOURCE SCAN of the landing markup — the same shape
   * check-boundaries.mjs uses — because rendering the whole landing page here
   * would drag in the demo island and the corpus.
   */
  it("is linked from the landing footer", () => {
    const landing = readFileSync(join(WEB_ROOT, "app/page.tsx"), "utf8");
    expect(landing).toMatch(/href="\/attribution"/);
  });

  it("claims no endorsement by any source project", () => {
    render(<AttributionPage />);

    // The explicit disclaimer is present…
    expect(
      BOUNDARIES.some((b) => /has reviewed, endorsed or approved/.test(b)),
    ).toBe(true);

    // …and nothing anywhere on the page claims the opposite.
    for (const claim of attributionStrings()) {
      expect(
        /\bendorsed by\b|\bapproved by\b|\bcertified by\b|\bin partnership with\b/i.test(claim) &&
          !/has reviewed, endorsed or approved/.test(claim),
        `an attribution string implies endorsement: "${claim}"`,
      ).toBe(false);
    }
  });

  /**
   * The page states that the Quran text is reproduced verbatim and never
   * generated — and that must be TRUE of this page.
   *
   * Asserted STRUCTURALLY rather than by scanning the rendered text for Arabic
   * codepoints. A codepoint-range detector would itself have to name the Arabic
   * range, and `check-boundaries.mjs` clause 4 forbids that in both literal and
   * `\u`-escaped form — the gate flagged this file's first draft, correctly.
   * The gate excludes only its own detector, and weakening it to admit a second
   * would trade a real repo-wide guarantee for one local convenience.
   *
   * The stronger claim is available anyway: this page cannot render Quranic
   * text because it never loads any. It imports no corpus module, reads no
   * staged corpus JSON, and touches no engine — so there is no path by which a
   * glyph could reach it.
   */
  it("loads no corpus or engine data, so it cannot render Quranic text", () => {
    const source = readFileSync(join(WEB_ROOT, "app/attribution/page.tsx"), "utf8");

    expect(source).not.toMatch(/@engine\//);
    expect(source).not.toMatch(/lib\/corpus/);
    expect(source).not.toMatch(/public\/corpus|corpus\.json/);

    // Its only data import is the attribution copy module.
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)]
      .map((m) => m[1])
      .filter((i): i is string => i !== undefined);
    const local = imports.filter((i) => i.startsWith("@/"));
    expect(local).toEqual(["@/lib/legal/attribution"]);
  });
});

describe("§15 — the page's tables are semantic", () => {
  it("uses real tables with column headers and a row header per source", () => {
    render(<AttributionPage />);

    const tables = screen.getAllByRole("table");
    expect(tables.length).toBe(2); // data sources + typefaces

    for (const table of tables) {
      // Real column headers, not a grid of divs.
      expect(within(table).getAllByRole("columnheader").length).toBe(3);
      // Every body row leads with a row header naming its source.
      expect(within(table).getAllByRole("rowheader").length).toBeGreaterThan(0);
    }

    // Every listed source appears as a row header somewhere on the page.
    for (const source of [...SOURCES, ...FONTS]) {
      expect(
        screen.getByRole("rowheader", { name: new RegExp(escapeRegExp(source.name)) }),
      ).toBeTruthy();
    }
  });

  it("gives every external link a safe target", () => {
    render(<AttributionPage />);
    for (const link of screen.getAllByRole("link")) {
      const href = link.getAttribute("href") ?? "";
      if (!href.startsWith("http")) continue;
      // `noopener` on a `_blank` link: without it the opened page can reach
      // back through window.opener.
      expect(link.getAttribute("rel") ?? "").toMatch(/noopener/);
    }
  });
});

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
