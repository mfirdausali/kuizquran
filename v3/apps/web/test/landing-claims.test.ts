// v3-D19 — THE CLAIM TEST. The runtime half of the CI clause.
//
//     "The app never claims to teach tajwid or replace a teacher. CI asserts no
//      landing or onboarding string makes either claim."          — v3-D19
//
// BUILD-PLAN names this a CI clause. There are TWO checks over ONE detector
// (`lib/landing/claims.ts#findClaims`), and neither subsumes the other:
//
//   - THIS FILE runs it over the actual VALUES of `landingStrings()` — every
//     string the page will really paint, including anything assembled at
//     render. A gate reading source text cannot evaluate a template literal.
//   - `check-boundaries.mjs` clause 11 runs the same patterns over the SOURCE
//     of the landing/onboarding-facing files, so a claim written directly into
//     JSX (where this test would never see it) still fails the build.
//
// ---------------------------------------------------------------------------
// THE DETECTOR IS TESTED AGAINST ITSELF FIRST
// ---------------------------------------------------------------------------
// A claim-checker asserting "the current copy is clean" proves nothing on its
// own: an EMPTY detector passes that assertion against every possible input,
// which is precisely v3-D49's "a guard whose test never distinguished the
// states it guarded". This build has shipped six such verifications.
//
// So the first describe block feeds it sentences that MUST fail. If the
// detector is ever weakened into a no-op, those tests go red before the
// "our copy is clean" test has a chance to be meaninglessly green.
//
// The second block asserts the honest DISCLAIMERS still pass — because a
// detector that banned "this app does not teach tajwid" would force the page to
// drop the very sentence v3-D19 wants it to make. Both directions matter.

import { describe, expect, it } from "vitest";
import { findClaims, findClaimsIn } from "../lib/landing/claims";
import { landingStrings, SECTION_ORDER } from "../lib/landing/copy";

/** v3-D19, quoted so a failure names the decision it contradicts. */
const V3_D19 = [
  "v3-D19 — The app never claims to teach tajwid or replace a teacher.",
  '  "CI asserts no landing or onboarding string makes either claim.',
  "   Position: the quiz is the daily driver; the teacher is the verifier.\"",
].join("\n");

describe("v3-D19 detector — sentences that MUST be caught", () => {
  // If any of these ever passes, the detector has been weakened into something
  // that cannot distinguish a violation from compliant copy.
  const MUST_FAIL: ReadonlyArray<readonly [string, string]> = [
    ["tajwid", "Learn tajwid from the first day."],
    ["tajwid", "This app teaches tajwid while you memorize."],
    ["tajwid", "Perfect your pronunciation with daily drills."],
    ["tajwid", "We correct your recitation as you go."],
    ["tajwid", "Tajwid lessons built into every session."],
    ["tajwid", "It listens to your recitation and grades it."],
    ["replaces-teacher", "It replaces your teacher."],
    ["replaces-teacher", "No teacher needed — everything you need is here."],
    ["replaces-teacher", "You don't need a teacher to finish a surah."],
    ["replaces-teacher", "Your sheikh in your pocket, every morning."],
    ["replaces-teacher", "Memorize the whole Quran without a teacher."],
    ["replaces-teacher", "Better than a tutor, and always available."],
    ["memorized", "You have now memorized your first ayah."],
    ["memorized", "You just memorized it."],
    ["memorized", "That's it memorized — on to the next one."],
    ["memorized", "Guaranteed you'll never forget it."],
    ["memorized", "You will never forget a verse again."],
  ];

  for (const [kind, sentence] of MUST_FAIL) {
    it(`catches: ${sentence}`, () => {
      const hits = findClaims(sentence);
      expect(hits.length, `${V3_D19}\n\nNOT CAUGHT: "${sentence}"`).toBeGreaterThan(0);
      expect(hits.map((h) => h.kind)).toContain(kind);
    });
  }
});

describe("v3-D19 detector — honest sentences that MUST pass", () => {
  // The disclaimers v3-D19 exists to PRODUCE. A detector that banned these
  // would force the page to stop saying the true thing, which is the exact
  // inversion of the rule.
  const MUST_PASS: readonly string[] = [
    "This app does not teach tajwid.",
    "It cannot hear you, so it never grades your pronunciation.",
    "The quiz is the daily driver. The teacher is the verifier.",
    "Pronunciation is not what it measures and not what it can measure.",
    "A teacher is the one who verifies how you sound.",
    "It does not do that job and does not pretend to.",
    // The learner's own past-tense report — §17's placement screen. Not a
    // claim by the app at all.
    "I memorised this before, but it has faded.",
    "Starting point: you have memorised this before",
    // §18's own approved hero. About memorization done years ago, elsewhere.
    "You memorized it. Do you still have it?",
    // The demo's completion line: what the visitor DID, not what they possess.
    "You just rebuilt the ayah from memory, in order, with nothing given.",
  ];

  for (const sentence of MUST_PASS) {
    it(`allows: ${sentence}`, () => {
      const hits = findClaims(sentence);
      expect(
        hits,
        `${V3_D19}\n\nFALSE POSITIVE — this sentence is HONEST and must be sayable:\n` +
          `"${sentence}"\nmatched: ${hits.map((h) => h.matched).join(", ")}`,
      ).toEqual([]);
    });
  }

  it("a disclaimer in one sentence does NOT launder a claim in the next", () => {
    // The negation-scoping property. If DISCHARGERS were applied per-paragraph
    // rather than per-sentence, this would pass and the rule would be trivially
    // bypassable by prefixing any claim with a denial.
    const laundered = "This app cannot hear you. It teaches tajwid.";
    expect(findClaims(laundered).length, V3_D19).toBeGreaterThan(0);
  });
});

describe("v3-D19 — the shipped landing copy", () => {
  it("makes no prohibited claim, in any string", () => {
    const strings = landingStrings();
    const hits = findClaimsIn(strings);
    expect(
      hits,
      `${V3_D19}\n\n` +
        hits
          .map((h) => `  [${h.kind}] "${h.matched}" in: ${strings[h.index]?.slice(0, 140)}`)
          .join("\n"),
    ).toEqual([]);
  });

  it("actually has copy to check — an empty corpus of strings proves nothing", () => {
    // Without this, deleting every string from copy.ts would make the test
    // above pass. That is the vacuous-verification shape, and it is the one
    // this build has shipped six times.
    const strings = landingStrings();
    expect(strings.length).toBeGreaterThan(20);
    expect(strings.every((s) => s.length > 0)).toBe(true);
  });

  it("says the positioning out loud rather than merely avoiding the claim", () => {
    // v3-D19's position is not "stay silent about teachers" — it is "the quiz
    // is the daily driver; the teacher is the verifier". Avoiding the subject
    // would satisfy the detector and miss the decision.
    const all = landingStrings().join(" ").toLowerCase();
    expect(all).toContain("teacher");
    expect(all).toContain("verif");
  });

  it("carries no testimonial (§18 section 6: no fake testimonials, ever)", () => {
    const all = landingStrings().join(" ");
    // A testimonial is a quoted human voice with an attribution. Neither the
    // curly nor the straight quotation form appears attributed to a person.
    expect(all).not.toMatch(/[""].{20,}[""]\s*[—–-]\s*[A-Z][a-z]+/);
    expect(all).not.toMatch(/\b\d+(?:,\d{3})*\+?\s+(?:happy\s+)?(?:users|learners|students)\b/i);
    expect(all).not.toMatch(/\b(?:rated|rating)\s+\d(?:\.\d)?\s*(?:\/|out of)\s*5\b/i);
  });
});

describe("§18 — the eight sections", () => {
  it("names exactly the eight sections in §18's table, in order", () => {
    expect(SECTION_ORDER).toEqual([
      "hero",
      "demo",
      "mechanism",
      "plan",
      "objections",
      "proof",
      "pricing",
      "footer",
    ]);
  });

  it("puts the DEMO second — it is the conversion engine (§18)", () => {
    // "The demo is the conversion engine. The mechanic sells itself;
    // describing it does not." A demo below the argument is a demo most
    // visitors never reach.
    expect(SECTION_ORDER[1]).toBe("demo");
  });
});
