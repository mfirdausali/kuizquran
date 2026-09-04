// THE GATE-A FRONTIER WORKLIST (build-plan step 25, WIREFRAME §22b).
//
// The wire shapes asserted here are not invented: they are read off
// `api/app/Http/Controllers/VerificationsController.php::index`, which emits
// `{ frontier: { "<ayah>": { qari, admin } }, verifications: [...] }` with each
// tier's value drawn from exactly {verified, stale, unverified}. The controller
// is the contract; these tests pin the client to it.
//
// THE TESTS THAT MATTER MOST HERE ARE THE FAILING-SAFE ONES. This module feeds
// the metric that blocks public launch (M9's exit criterion, "frontier 100%
// green hash-current"). Every way it could paint green when it should not is a
// launch-gate lie, so each one gets its own test.

import { describe, expect, it } from "vitest";
import { buildWorklist, reduceChip, type FrontierResponse } from "@/lib/workbench/frontier";

/** Build a response the way the controller does — tiers first, ayah keys as
 *  strings (JSON object keys always are). */
function wire(
  rows: Record<number, { qari: string; admin: string }>,
): FrontierResponse {
  const frontier: Record<string, { qari: string; admin: string }> = {};
  for (const [ayah, tiers] of Object.entries(rows)) frontier[ayah] = tiers;
  return { frontier };
}

describe("reduceChip — the weakest tier wins", () => {
  it("is green ONLY when both tiers are verified", () => {
    expect(reduceChip("verified", "verified")).toBe("verified");
    // The launch-gate lie this prevents: one signed tier painting the ayah
    // green while the other has drifted or was never reviewed.
    expect(reduceChip("verified", "stale")).toBe("stale");
    expect(reduceChip("stale", "verified")).toBe("stale");
    expect(reduceChip("verified", "unverified")).toBe("unverified");
    expect(reduceChip("unverified", "verified")).toBe("unverified");
  });

  it("unverified outranks stale — an unreviewed tier is the weaker fact", () => {
    expect(reduceChip("stale", "unverified")).toBe("unverified");
    expect(reduceChip("unverified", "stale")).toBe("unverified");
    expect(reduceChip("stale", "stale")).toBe("stale");
    expect(reduceChip("unverified", "unverified")).toBe("unverified");
  });

  it("is exhaustive over the 9 tier pairs and never invents a fourth state", () => {
    const tiers = ["verified", "stale", "unverified"] as const;
    const seen = new Set<string>();
    for (const q of tiers) for (const a of tiers) seen.add(reduceChip(q, a));
    expect([...seen].sort()).toEqual(["stale", "unverified", "verified"]);
  });
});

describe("an unrecognised status fails to the SAFE side", () => {
  it("treats an unknown tier value as unverified, never as verified", () => {
    // A server that grows a fourth status, or a typo'd one, must not paint
    // green. This is the direction that matters: a false grey costs a review,
    // a false green ships unreviewed Quranic content.
    const w = buildWorklist({
      frontier: { "1": { qari: "approved", admin: "verified" } },
    } as FrontierResponse);
    expect(w.rows[0]!.qari).toBe("unverified");
    expect(w.rows[0]!.chip).toBe("unverified");
    expect(w.allGreen).toBe(false);
  });

  it("treats a MISSING tier as unverified", () => {
    const w = buildWorklist({ frontier: { "1": { qari: "verified" } } } as FrontierResponse);
    expect(w.rows[0]!.admin).toBe("unverified");
    expect(w.rows[0]!.chip).toBe("unverified");
  });
});

describe("worklist ORDER is the point — stale first, then unverified, then verified", () => {
  it("orders by urgency, then ayah ascending within a band", () => {
    const w = buildWorklist(
      wire({
        3: { qari: "verified", admin: "verified" },
        7: { qari: "stale", admin: "verified" },
        1: { qari: "unverified", admin: "unverified" },
        9: { qari: "verified", admin: "verified" },
        2: { qari: "verified", admin: "stale" },
        5: { qari: "unverified", admin: "verified" },
      }),
    );
    // Stale (2, 7), then unverified (1, 5), then verified (3, 9).
    expect(w.rows.map((r) => r.ayah)).toEqual([2, 7, 1, 5, 3, 9]);
    expect(w.rows.map((r) => r.chip)).toEqual([
      "stale",
      "stale",
      "unverified",
      "unverified",
      "verified",
      "verified",
    ]);
  });

  it("stale sorts ABOVE unverified — a reviewed artifact that regressed is the urgent one", () => {
    const w = buildWorklist(
      wire({
        1: { qari: "unverified", admin: "unverified" },
        2: { qari: "stale", admin: "stale" },
      }),
    );
    // Ayah 2 outranks ayah 1 despite the higher number: priority beats order.
    expect(w.rows.map((r) => r.ayah)).toEqual([2, 1]);
  });
});

describe("counts and allGreen", () => {
  it("counts partition the rows exactly", () => {
    const w = buildWorklist(
      wire({
        1: { qari: "verified", admin: "verified" },
        2: { qari: "stale", admin: "verified" },
        3: { qari: "unverified", admin: "unverified" },
        4: { qari: "verified", admin: "verified" },
      }),
    );
    expect(w.verified).toBe(2);
    expect(w.stale).toBe(1);
    expect(w.unverified).toBe(1);
    expect(w.verified + w.stale + w.unverified).toBe(w.rows.length);
  });

  it("allGreen is true only when EVERY row is green on BOTH tiers", () => {
    expect(
      buildWorklist(
        wire({
          1: { qari: "verified", admin: "verified" },
          2: { qari: "verified", admin: "verified" },
        }),
      ).allGreen,
    ).toBe(true);
    expect(
      buildWorklist(
        wire({
          1: { qari: "verified", admin: "verified" },
          2: { qari: "verified", admin: "stale" },
        }),
      ).allGreen,
    ).toBe(false);
  });

  it("an EMPTY frontier is never allGreen — vacuous truth is the dangerous reading", () => {
    // "0 of 0 verified, therefore 100%" would report GATE-A satisfied on a
    // surah with nothing ingested. This is the single most dangerous sentence
    // this screen could produce.
    expect(buildWorklist({ frontier: {} }).allGreen).toBe(false);
    expect(buildWorklist({ frontier: {} }).rows).toEqual([]);
    expect(buildWorklist(null).allGreen).toBe(false);
    expect(buildWorklist({}).allGreen).toBe(false);
  });
});

describe("totality — a malformed response degrades, never throws into a render", () => {
  it("drops non-numeric and non-positive ayah keys instead of rendering them", () => {
    const w = buildWorklist({
      frontier: {
        "1": { qari: "verified", admin: "verified" },
        abc: { qari: "verified", admin: "verified" },
        "0": { qari: "verified", admin: "verified" },
        "-3": { qari: "verified", admin: "verified" },
        "2.5": { qari: "verified", admin: "verified" },
      },
    } as FrontierResponse);
    expect(w.rows.map((r) => r.ayah)).toEqual([1]);
  });

  it("survives a null tier object", () => {
    const w = buildWorklist({
      frontier: { "1": null as unknown as { qari: string } },
    } as FrontierResponse);
    expect(w.rows[0]!.chip).toBe("unverified");
  });
});

describe("the note names WHICH tier moved — an admin has to know what to re-sign", () => {
  it("names the stale tier", () => {
    const w = buildWorklist(wire({ 1: { qari: "stale", admin: "verified" } }));
    expect(w.rows[0]!.note).toContain("qari");
    expect(w.rows[0]!.note).not.toContain("admin");
    expect(w.rows[0]!.note).toContain("re-sign");
  });

  it("names both when both moved, and reports stale and missing separately", () => {
    const w = buildWorklist(wire({ 1: { qari: "stale", admin: "unverified" } }));
    expect(w.rows[0]!.note).toContain("re-sign");
    expect(w.rows[0]!.note).toContain("never reviewed");
  });

  it("says so plainly when nothing is outstanding", () => {
    const w = buildWorklist(wire({ 1: { qari: "verified", admin: "verified" } }));
    expect(w.rows[0]!.note).toContain("hash-current");
  });
});

describe("hashIngestedAt — when THIS ayah's current hash was last ingested (v3-D176)", () => {
  it("carries the server's own per-ayah timestamp through untouched", () => {
    const w = buildWorklist({
      frontier: {
        "1": { qari: "verified", admin: "verified", ingestedAt: 1700000000000 },
        "2": { qari: "verified", admin: "verified", ingestedAt: 1600000000000 },
      },
    } as FrontierResponse);
    const byAyah = new Map(w.rows.map((r) => [r.ayah, r.hashIngestedAt]));
    expect(byAyah.get(1)).toBe(1700000000000);
    expect(byAyah.get(2)).toBe(1600000000000);
  });

  it("degrades a missing or malformed value to null, never a fabricated timestamp", () => {
    const missing = buildWorklist({
      frontier: { "1": { qari: "verified", admin: "verified" } },
    } as FrontierResponse);
    expect(missing.rows[0]!.hashIngestedAt).toBeNull();

    const malformed = buildWorklist({
      frontier: { "1": { qari: "verified", admin: "verified", ingestedAt: "not-a-number" } },
    } as unknown as FrontierResponse);
    expect(malformed.rows[0]!.hashIngestedAt).toBeNull();
  });
});
