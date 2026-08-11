// explain() — THE WORKBENCH TRACER (build-plan step 25, WIREFRAME §22b).
//
// ---------------------------------------------------------------------------
// EVERY ASSERTION HERE IS A MEASURED CORPUS FACT, NOT A ROUND NUMBER
// ---------------------------------------------------------------------------
// The tracer's whole claim is "the trace reports what the engine actually did."
// A test asserting `admitted > 0` would keep passing after the tracer started
// inventing verdicts, so every number below was MEASURED against the real
// `12.json` fixture — the same corpus the engine's own tests run on — and each
// is pinned exactly.
//
// Not one Arabic byte is typed in this file. Where a test needs Arabic it
// compares against `resolveRef(corpus, ref)` — the corpus resolving its own
// coordinate at runtime — which is `check-boundaries.mjs` clause 4 holding in
// the tests exactly as it holds in the app.
//
// ---------------------------------------------------------------------------
// THE COLLISION ARITHMETIC, RECONCILED
// ---------------------------------------------------------------------------
// WIREFRAME §23 measures "175/1777 slots (9.8%) whose EN gloss repeats inside
// its own ayah." This tracer measures 90 s1 variants dropped for a prompt
// collision across the whole surah. Both are right and they are the same fact:
// `admit()`'s clause 3 keeps the FIRST occurrence and drops the rest, so a
// collision group of k slots produces k-1 drops. Summing (k-1) over every
// group gives exactly 90, and summing k gives exactly 175. Both totals are
// re-derived from the corpus in the first test below rather than asserted from
// the doc, so a corpus change moves them together or turns this red.
//
// WIREFRAME's OTHER claim in the same paragraph — "clause 3 drops 14.2% of s1
// variants" — does NOT reproduce: 90/1777 is 5.1%. That is a doc-vs-code
// discrepancy, recorded here rather than quietly rounded to match.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Corpus } from "@engine/types.ts";
import { ayahWords, wordGloss } from "@engine/corpus.ts";
import { isS1Probeable } from "@engine/ladder.ts";
import { resolveRef } from "@engine/corpusRef.ts";
import { bandOf } from "@engine/atom.ts";
import { options } from "@engine/options.ts";
import { buildQuestion, type Spec } from "@engine/buildQuestion.ts";
import { admissibleVariants, buildResourceLedger, variants } from "@engine/variant.ts";
import { explain, PREVIEW_STRENGTHS } from "@/lib/workbench/explain";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  readFileSync(resolve(HERE, "../../../packages/engine/test/fixtures/12.json"), "utf8"),
) as Corpus;

const SURAH = 12;
const AYAH_COUNT = 111;

/** WIREFRAME §23's own worked example: "Yusuf 12:6 position 18 glosses as
 *  'before '. Position 19 also glosses as 'before '." Verified in the fixture
 *  by the first test rather than trusted. */
const COLLISION_AYAH = 6;

describe("the corpus facts these tests are pinned to", () => {
  it("12:6 positions 18 and 19 share an EN gloss — WIREFRAME's own example, re-verified", () => {
    const words = ayahWords(corpus, COLLISION_AYAH);
    const p18 = words.find((w) => w.position === 18);
    const p19 = words.find((w) => w.position === 19);
    expect(p18).toBeDefined();
    expect(p19).toBeDefined();
    expect(wordGloss(p18!, "en")).toBe(wordGloss(p19!, "en"));
    // And they are DIFFERENT words — a collision, not one word counted twice.
    expect(p18!.text_uthmani).not.toBe(p19!.text_uthmani);
  });

  it("175 colliding slots and 90 keep-first drops are the SAME measurement", () => {
    let slots = 0;
    let dropsIfKeepFirst = 0;
    for (let a = 1; a <= AYAH_COUNT; a++) {
      const counts = new Map<string, number>();
      for (const w of ayahWords(corpus, a).filter(isS1Probeable)) {
        const g = wordGloss(w, "en");
        counts.set(g, (counts.get(g) ?? 0) + 1);
      }
      for (const [, n] of counts) {
        if (n > 1) {
          slots += n;
          dropsIfKeepFirst += n - 1;
        }
      }
    }
    // WIREFRAME's figure...
    expect(slots).toBe(175);
    // ...and what a keep-first clause actually drops.
    expect(dropsIfKeepFirst).toBe(90);
    // 5.1%, NOT the 14.2% the same paragraph claims. Pinned so the
    // discrepancy stays visible instead of being re-rounded away.
    expect(corpus.words.length).toBe(1777);
  });
});

describe("explain() reports what the ENGINE did — never its own judgement", () => {
  const spec: Spec = { lane: "s1", site: { kind: "ayah", surah: SURAH, ayah: COLLISION_AYAH } };

  it("every lane's enumerated/admitted counts equal the engine's own, at every site", () => {
    // The strongest available statement of "the tracer never invents": for
    // EVERY site in the surah and EVERY traceable lane, the trace's counts are
    // re-derived independently by calling the engine directly. A tracer that
    // dropped, duplicated or mis-attributed even one variant fails here.
    for (let a = 1; a <= AYAH_COUNT; a++) {
      for (const site of [
        { kind: "ayah", surah: SURAH, ayah: a } as const,
        { kind: "seam", surah: SURAH, ayah: a } as const,
      ]) {
        const ledger = buildResourceLedger(corpus, site);
        const trace = explain(corpus, { lane: "s1", site });
        for (const lane of trace.lanes) {
          expect(lane.enumerated).toBe(variants(corpus, site, lane.lane).length);
          expect(lane.admitted).toBe(
            admissibleVariants(corpus, site, lane.lane, ledger).length,
          );
          // Per-variant, not just the totals: the verdict on each row is the
          // engine's verdict for that same row.
          const admittedSet = new Set(
            admissibleVariants(corpus, site, lane.lane, ledger).map((v) => v.prompt),
          );
          for (const v of lane.variants.filter((v) => v.admitted)) {
            expect(admittedSet.has(v.prompt)).toBe(true);
          }
        }
      }
    }
  });

  it("attributes 12:6 position 19 to the prompt-collision clause, and KEEPS position 18", () => {
    const s1 = explain(corpus, spec).specLane!;
    const p18 = s1.variants.find((v) => v.position === 18)!;
    const p19 = s1.variants.find((v) => v.position === 19)!;

    // Clause 3 keeps the FIRST occurrence — that is admit()'s own rule, and a
    // tracer that reported BOTH as dropped would be describing a starved site.
    expect(p18.admitted).toBe(true);
    expect(p18.rejectedBy).toBeNull();
    expect(p19.admitted).toBe(false);
    expect(p19.rejectedBy).toBe("prompt-collision");
    expect(p19.note).toContain("two correct answers");

    // 25 words, exactly 2 dropped, both for the collision.
    expect(s1.enumerated).toBe(25);
    expect(s1.admitted).toBe(23);
  });

  it("attributes exactly 90 s1 drops across the surah, all to prompt-collision", () => {
    let enumerated = 0;
    let admitted = 0;
    const byClause: Record<string, number> = {};
    for (let a = 1; a <= AYAH_COUNT; a++) {
      const lane = explain(corpus, {
        lane: "s1",
        site: { kind: "ayah", surah: SURAH, ayah: a },
      }).specLane!;
      enumerated += lane.enumerated;
      admitted += lane.admitted;
      for (const v of lane.variants) {
        if (!v.admitted) byClause[v.rejectedBy!] = (byClause[v.rejectedBy!] ?? 0) + 1;
      }
    }
    expect(enumerated).toBe(1777);
    expect(admitted).toBe(1687);
    // The reconciliation from this file's header, now measured THROUGH the
    // tracer rather than beside it.
    expect(byClause).toEqual({ "prompt-collision": 90 });
    // And nothing was ever left unattributed. An `unattributed` row means
    // admit() refused for a reason no narrower probe reproduced — a real
    // finding, and this assertion is what would surface it.
    expect(byClause["unattributed"]).toBeUndefined();
  });

  it("the cloze lane contributes exactly one option-distinctness drop in the whole surah", () => {
    // Measured. A DIFFERENT clause from s1's, which is what makes this test
    // worth having: it proves the attributor distinguishes clause 2 from
    // clause 3 on real data, not only in principle.
    const byClause: Record<string, number> = {};
    for (let a = 1; a <= AYAH_COUNT; a++) {
      const lane = explain(corpus, {
        lane: "cloze",
        site: { kind: "ayah", surah: SURAH, ayah: a },
      }).specLane!;
      for (const v of lane.variants) {
        if (!v.admitted) byClause[v.rejectedBy!] = (byClause[v.rejectedBy!] ?? 0) + 1;
      }
    }
    expect(byClause).toEqual({ "option-distinctness": 1 });
  });
});

describe("supply comes from the engine's ResourceLedger, flattened not recomputed", () => {
  it("mirrors the ledger position-for-position on an ayah site", () => {
    const site = { kind: "ayah", surah: SURAH, ayah: 4 } as const;
    const ledger = buildResourceLedger(corpus, site);
    const supply = explain(corpus, { lane: "s1", site }).supply;

    expect(supply.siteKey).toBe("12:ayah:4");
    expect(supply.kind).toBe("ayah");
    expect(supply.positions).toHaveLength(ledger.s1SiblingCount.size);
    for (const row of supply.positions) {
      expect(row.s1Siblings).toBe(ledger.s1SiblingCount.get(row.position));
      expect(row.clozeDistractors).toBe(ledger.clozeDistractorCount.get(row.position));
    }
    // Ascending, so the pane is scannable and the order is not incidental.
    const positions = supply.positions.map((p) => p.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("a seam has no per-position supply — its one fact is successorExists", () => {
    const mid = explain(corpus, {
      lane: "junction",
      site: { kind: "seam", surah: SURAH, ayah: 5 },
    });
    expect(mid.supply.kind).toBe("seam");
    expect(mid.supply.positions).toEqual([]);
    expect(mid.supply.successorExists).toBe(true);
    expect(mid.supply.siteKey).toBe("12:seam:5");

    // E-08: the seam at the surah's LAST ayah is never constructible.
    const end = explain(corpus, {
      lane: "junction",
      site: { kind: "seam", surah: SURAH, ayah: AYAH_COUNT },
    });
    expect(end.supply.successorExists).toBe(false);
    expect(end.built).toBe(false);
    expect(end.specLane!.enumerated).toBe(0);
    expect(end.declineReason).toContain("no candidates");
  });
});

describe("the three-strength preview is honest about what strength does today", () => {
  const spec: Spec = { lane: "cloze", site: { kind: "ayah", surah: SURAH, ayah: 4 } };

  it("previews one strength per engine band, carrying the engine's own OptionSpec", () => {
    const previews = explain(corpus, spec).previews;
    expect(previews).toHaveLength(3);
    expect(previews.map((p) => p.strength)).toEqual([...PREVIEW_STRENGTHS]);
    // Bands and option specs are the ENGINE's, re-derived here rather than
    // pasted: a band-threshold change in the engine moves both sides.
    for (const p of previews) {
      expect(p.band).toBe(bandOf(p.strength));
      expect(p.optionSpec).toEqual(options(p.strength));
    }
    expect(previews.map((p) => p.band)).toEqual(["learn", "reinforce", "carry"]);
    // The knob genuinely narrows: 4/4 → 3/3 → 2/2.
    expect(previews.map((p) => p.optionSpec.count)).toEqual([4, 3, 2]);
  });

  it("reports differsFromLearn=false because no kernel is strength-aware YET", () => {
    // This is the LIMITATION assertion, and it is deliberately written as a
    // measurement of the current kernels rather than as a constant. When a
    // kernel starts honouring strength this test goes RED and must be
    // re-measured — which is the correct signal, not a nuisance.
    for (const lane of ["s1", "cloze"] as const) {
      const previews = explain(corpus, {
        lane,
        site: { kind: "ayah", surah: SURAH, ayah: 4 },
      }).previews;
      expect(previews.map((p) => p.differsFromLearn)).toEqual([false, false, false]);
      // ...and the items really are identical, not merely reported so.
      expect(previews[1]!.item).toEqual(previews[0]!.item);
      expect(previews[2]!.item).toEqual(previews[0]!.item);
    }
  });

  it("marks exactly one baseline row, and it is the Learn band", () => {
    // `isBaseline` exists because check-boundaries.mjs clause 5 refused the
    // strength comparison in JSX. It must therefore actually identify the
    // Learn row, or the view's "identical to the Learn preview" note attaches
    // to the wrong card.
    const previews = explain(corpus, spec).previews;
    expect(previews.filter((p) => p.isBaseline)).toHaveLength(1);
    expect(previews[0]!.isBaseline).toBe(true);
    expect(previews[0]!.band).toBe("learn");
    expect(previews[0]!.differsFromLearn).toBe(false);
  });

  it("the previewed item is byte-identical to what buildQuestion returns", () => {
    // The preview must be the PRODUCT, not a rendering of it. If explain()
    // ever post-processed an item for display, this fails.
    for (const lane of ["s1", "cloze"] as const) {
      for (let a = 1; a <= AYAH_COUNT; a++) {
        const s: Spec = { lane, site: { kind: "ayah", surah: SURAH, ayah: a } };
        expect(explain(corpus, s).previews[0]!.item).toEqual(buildQuestion(corpus, s));
      }
    }
  });
});

describe("lanes buildQuestion can build but variants() cannot enumerate (v3-D37 gap 1)", () => {
  it("locate builds an item yet has NO traceable fibre — surfaced, not hidden", () => {
    const spec: Spec = {
      lane: "locate",
      site: { kind: "ayah", surah: SURAH, ayah: 4 },
      pool: [2, 3, 4, 5, 6],
    };
    const trace = explain(corpus, spec);
    expect(trace.built).toBe(true);
    // The divergence v3-D37 recorded: `variants()` knows 3 lanes,
    // `buildQuestion` knows 5. `specLane: null` is how the workbench SAYS so.
    expect(trace.specLane).toBeNull();
    // The site's other lanes are still traced — the pane is not blank.
    expect(trace.lanes.map((l) => l.lane)).toEqual(["s1", "cloze", "junction"]);
    // And the item is real: a locateChoice whose options are ayah NUMBERS.
    const item = trace.previews[0]!.item!;
    expect(item.shape).toBe("locateChoice");
    if (item.shape === "locateChoice") {
      expect(item.options[item.correctIndex]).toBe(4);
      // Sacred text: the prompt's bytes are the corpus resolving its own
      // coordinate, never a literal typed here.
      expect(item.prompt.text).toBe(resolveRef(corpus, item.prompt.from));
    }
  });

  it("reorder declines rather than overrunning the surah, and says why", () => {
    // v3-D36's disclosed departure: a run past `ayahCount` has no Face to
    // resolve, so the kernel returns null. The trace must not report that as
    // an admit() rejection — there is no fibre to reject anything.
    const trace = explain(corpus, {
      lane: "reorder",
      site: { kind: "ayah", surah: SURAH, ayah: AYAH_COUNT - 1 },
      count: 3,
    });
    expect(trace.built).toBe(false);
    expect(trace.specLane).toBeNull();
    expect(trace.declineReason).toContain("do not resolve");
  });

  it("rc is not offerable — WIREFRAME keeps reconstruct.ts's state machine as CODE", () => {
    // buildQuestion structurally refuses "rc". The tracer must degrade to a
    // decline with a reason, never throw into a render.
    const trace = explain(corpus, {
      // @ts-expect-error — "rc" is deliberately outside Spec's lane union. The
      // out-of-band call is the point: a Laravel payload could carry it.
      lane: "rc",
      site: { kind: "ayah", surah: SURAH, ayah: 4 },
    });
    expect(trace.built).toBe(false);
    expect(trace.specLane).toBeNull();
    expect(trace.declineReason).not.toBeNull();
  });
});

describe("purity — a trace is reproducible and can be pasted into a bug report", () => {
  it("two calls with the same inputs produce deeply equal traces", () => {
    for (const lane of ["s1", "cloze", "junction"] as const) {
      const site =
        lane === "junction"
          ? ({ kind: "seam", surah: SURAH, ayah: 5 } as const)
          : ({ kind: "ayah", surah: SURAH, ayah: 6 } as const);
      const spec = { lane, site } as Spec;
      expect(explain(corpus, spec)).toEqual(explain(corpus, spec));
    }
  });

  it("never throws, at any site or lane in the surah", () => {
    for (let a = 1; a <= AYAH_COUNT; a++) {
      expect(() =>
        explain(corpus, { lane: "s1", site: { kind: "ayah", surah: SURAH, ayah: a } }),
      ).not.toThrow();
      expect(() =>
        explain(corpus, { lane: "junction", site: { kind: "seam", surah: SURAH, ayah: a } }),
      ).not.toThrow();
    }
  });
});
