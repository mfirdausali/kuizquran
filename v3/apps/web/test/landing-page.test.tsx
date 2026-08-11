/**
 * @vitest-environment jsdom
 */

// THE LANDING PAGE — build-plan step 29, WIREFRAME §18.
//
// Two kinds of assertion here, deliberately separated:
//
//   1. RENDER assertions over `<PricingPanel/>`, which is a pure Server
//      Component with no async and no data source but the pricing constants —
//      so it renders under @testing-library/react exactly as it does in the
//      app, and every number on it can be checked against v3-D07.
//
//   2. STRUCTURAL assertions over `app/page.tsx` as a FILE. The page itself
//      composes a client island (<InlineDemo/> fetches) and <OnboardedSteer/>
//      (which opens IndexedDB), so rendering the whole tree here would test
//      the harness more than the page. What matters about the page — that it
//      is a Server Component, that it captures no identity, that its prose all
//      comes from the copy module, that the CTA leads into the drill and not
//      into a form — is decidable from the source, and those are exactly the
//      properties a well-meaning later edit breaks SILENTLY.
//
// The demo's own behaviour is covered in `landing-demo.test.tsx`, against the
// real engine and the real corpus.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PricingPanel } from "../components/landing/PricingPanel";
import { PRICING, TRIAL, formatPrice } from "../lib/pricing";
import { FOOTER, HERO, PROOF, SECTION_ORDER } from "../lib/landing/copy";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "..");
const read = (rel: string) => readFileSync(resolve(WEB, rel), "utf8");

/** Strip comments so an assertion inspects CODE, not prose ABOUT the code —
 *  the same construction check-boundaries.mjs and shell.test.ts use, and for
 *  the same reason: this page's header documents the very rules asserted
 *  below, so a naive substring match fires on the explanation rather than on a
 *  violation. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PAGE = "app/page.tsx";

// Without this, each render appends another copy of the panel to the same
// document and the DOM queries below match across ALL of them — which is how a
// "both regions are shown" assertion passes on a page rendering one region
// twice.
afterEach(() => cleanup());

describe("§18 — the page is a PRE-RECALL surface (gate clause 8)", () => {
  it("captures no identity of any kind", () => {
    const src = code(read(PAGE));
    // WIREFRAME §17: "no account, no email, no notification prompt until the
    // learner has produced an ayah from memory." check-boundaries clause 8
    // owns this too; asserting it here means a regression fails `npm test` and
    // not only `npm run build`.
    expect(src).not.toMatch(/type=["']email["']/);
    expect(src).not.toMatch(/type=["']password["']/);
    expect(src).not.toMatch(/name=["']email["']/);
    expect(src).not.toMatch(/Notification\.requestPermission/);
    expect(src).not.toMatch(/<form\b/);
    expect(src).not.toMatch(/<input\b/);
  });

  it("does NOT opt out of clause 8", () => {
    // The opt-out marker exists so a surface that legitimately captures
    // identity AFTER recall can say so. The landing page is the FIRST thing a
    // stranger sees; if this marker ever appears here, the rule has been
    // switched off on the one surface it most exists for.
    expect(read(PAGE)).not.toContain("@allow-identity-capture");
  });

  it("is listed in the gate's PRE_RECALL set", () => {
    // A pre-recall route the clause does not name is a hole. Asserted here so
    // that removing the entry from the gate fails the test suite too.
    const gate = read("scripts/check-boundaries.mjs");
    expect(gate).toMatch(/PRE_RECALL\s*=\s*\[[^\]]*app\\\/page\\\.tsx/);
  });

  it("the CTA leads into the app, never into a form", () => {
    const src = code(read(PAGE));
    expect(src).toMatch(/CTA_HREF\s*=\s*"\//);
    // The button text is the copy module's, and §18's: "Start with one ayah —
    // free, no account."
    expect(HERO.cta.toLowerCase()).toContain("no account");
  });
});

describe("§18 — the page is a SERVER component and stays one", () => {
  it('does not declare "use client"', () => {
    // v3-D14: "/" is a real stateless page, cacheable and servable by the
    // service worker while offline. Making it a client component would forfeit
    // that for the sake of two islands that already carry their own.
    const first = read(PAGE).split("\n").slice(0, 6).join("\n");
    expect(first).not.toMatch(/["']use client["']/);
  });

  it("reads no log — a landing page has no learner", () => {
    const src = code(read(PAGE));
    expect(src).not.toMatch(/from\s+["'][^"']*lib\/idb/);
    expect(src).not.toMatch(/useState|useEffect/);
  });

  it("is outside the (app) route group, so it grows no tab bar", () => {
    // v3-D14 / edge case #71. Showing learner navigation to a visitor who has
    // not started would be a lie about what they have.
    expect(() => read("app/page.tsx")).not.toThrow();
    expect(() => read("app/(app)/page.tsx")).toThrow();
  });
});

describe("§18 — eight sections, and the DEMO is second", () => {
  it("renders every section in SECTION_ORDER, driven by the constant", () => {
    const src = code(read(PAGE));
    // The page maps over SECTION_ORDER rather than inlining eight blocks, so
    // reordering the constant reorders the page — which is what makes §18's
    // contemplated A/B test a one-line edit instead of a markup reshuffle no
    // test would notice.
    expect(src).toMatch(/SECTION_ORDER\.map/);
    for (const id of SECTION_ORDER) {
      expect(src, `section "${id}" must have a case`).toMatch(
        new RegExp(`case\\s+"${id}":`),
      );
    }
  });

  it("has an exhaustiveness proof, so a ninth section cannot silently vanish", () => {
    const src = code(read(PAGE));
    expect(src).toMatch(/const\s+_exhaustive:\s*never\s*=\s*id/);
  });

  it("mounts the demo from the NEUTRAL shared directory", () => {
    // §17 screen 2 and §18 §2 are one artifact. If this import ever points at
    // components/onboarding/ or at a landing-local copy, the two surfaces have
    // forked.
    const src = code(read(PAGE));
    expect(src).toMatch(/from\s+["']@\/components\/demo\/InlineDemo["']/);
  });
});

describe("§18 — prose lives in the copy module, never in the markup", () => {
  it("the page imports its sentences rather than containing them", () => {
    const src = code(read(PAGE));
    expect(src).toMatch(/from\s+["']@\/lib\/landing\/copy["']/);
  });

  it("clause 12 exists to enforce this at build time", () => {
    // The test above checks the import is present; it cannot see a sentence
    // typed in beside it. Clause 12 does, and this asserts the clause is real
    // — mutating it away must fail something.
    const gate = read("scripts/check-boundaries.mjs");
    expect(gate).toMatch(/LANDING_MARKUP/);
    expect(gate).toMatch(/PROSE_TEXT_NODE/);
  });
});

describe("§18 section 6 — proof without users", () => {
  it("cites named sources a reader can go and check", () => {
    expect(PROOF.citations.length).toBeGreaterThanOrEqual(3);
    for (const c of PROOF.citations) {
      // An author and a year. A claim without an attribution is an appeal to
      // authority wearing a citation's clothes.
      expect(c.source, `"${c.source}" must name a year`).toMatch(/\b(?:19|20)\d\d\b/);
      expect(c.source.length).toBeGreaterThan(10);
      expect(c.claim.length).toBeGreaterThan(40);
    }
  });

  it("states on the page that there are no testimonials", () => {
    // §18: "No fake testimonials, ever." Saying so is stronger than merely
    // having none — a visitor cannot tell "none yet" from "never invented".
    expect(PROOF.noTestimonials.toLowerCase()).toContain("testimonial");
  });
});

describe("§18 section 8 — the footer's promises", () => {
  it("carries the four 'no's verbatim", () => {
    for (const promise of ["No ads", "No selling data", "No dark patterns", "No guilt notifications"]) {
      expect(FOOTER.ethics).toContain(promise);
    }
  });

  it("carries v3-D07's honest addition", () => {
    // "You pay us, so you are the customer — not the product." Added in the
    // same change that made the old "free forever" copy false.
    expect(FOOTER.customer.toLowerCase()).toContain("customer");
    expect(FOOTER.customer.toLowerCase()).toContain("not the product");
  });

  it("states v3-D19's positioning where a skimmer will see it", () => {
    expect(FOOTER.position).toMatch(/daily driver/i);
    expect(FOOTER.position).toMatch(/verifier/i);
  });
});

describe("§18 section 7 — pricing renders v3-D07 and nothing else", () => {
  it("shows every price from the constants, formatted by formatPrice", () => {
    render(<PricingPanel />);
    for (const region of ["MY", "INTL"] as const) {
      const p = PRICING[region];
      expect(screen.getByText(formatPrice(p.monthly, p.currency))).toBeTruthy();
      expect(screen.getByText(formatPrice(p.lifetime, p.currency))).toBeTruthy();
    }
  });

  it("shows BOTH regions — a landing page must not geo-hide a tier", () => {
    // v3-D07: strict IP locking "would shut out the Malaysian diaspora — the
    // segment most able to pay". Showing one detected price would hide the
    // other tier's existence from exactly that segment.
    render(<PricingPanel />);
    // Scoped to the region CARDS, not any mention of a region name — the
    // region note beneath them legitimately says "Malaysia" too, and matching
    // that would let a page with one card and a sentence pass.
    const cards = Array.from(document.querySelectorAll(".price-card"));
    expect(cards.length, "one card per region, both always shown").toBe(2);
    const headers = cards.map((c) => c.querySelector(".card-header")?.textContent ?? "");
    expect(headers.some((h) => /malaysia/i.test(h))).toBe(true);
    expect(headers.some((h) => /everywhere else/i.test(h))).toBe(true);
  });

  it("never advertises FPX beside the recurring plan (edge case #120)", () => {
    // FPX cannot recur. A monthly plan showing FPX is a promise the payment
    // rail cannot keep, discovered at the worst possible moment.
    expect(PRICING.MY.monthlyRails).not.toContain("fpx");
    render(<PricingPanel />);
    const rails = Array.from(document.querySelectorAll(".price-rails")).map(
      (n) => n.textContent ?? "",
    );
    // The first rails line under the MY card belongs to the monthly row.
    expect(rails[0]?.toLowerCase()).not.toContain("fpx");
  });

  it("makes v3-D07's one ethical obligation impossible to miss", () => {
    // "The paywall must NEVER hold a learner's memory hostage." It is the
    // sentence a learner most needs when a memorization app mentions money, so
    // it is a banner and not a caption.
    render(<PricingPanel />);
    const banner = document.querySelector(".banner");
    expect(banner?.textContent?.toLowerCase()).toContain("never held hostage");
    // Teal, never coral: nothing has slipped (locked §8 rule 2).
    expect(banner?.className).toContain("banner--ok");
  });

  it("states the trial from the same constant the entitlement gate reads", () => {
    render(<PricingPanel />);
    const text = document.body.textContent ?? "";
    expect(text).toContain(`${TRIAL.surahs} surah`);
    expect(text).toContain(`${TRIAL.days} days`);
  });

  it("contains no price literal of its own (clause 10)", () => {
    const src = code(read("components/landing/PricingPanel.tsx"));
    expect(src).not.toMatch(/RM\s?\d/);
    expect(src).not.toMatch(/USD\s?\d/);
  });
});
