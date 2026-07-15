import { describe, expect, it } from "vitest";
import { loadInputs, buildFromInputs } from "../src/io.ts";
import { validateCorpus } from "../src/validate.ts";
import { buildCorpus } from "../src/buildCorpus.ts";
import type { CorpusJson } from "../src/types.ts";

const inp = loadInputs();
const corpus = buildFromInputs(inp);
const report = validateCorpus(corpus, inp.verses, inp.qac.fullQuranWordSet);

describe("validation on the real corpus", () => {
  it("passes overall (no hard failures)", () => {
    const hardFails = report.checks.filter((c) => c.severity === "hard" && !c.pass);
    expect(hardFails.map((c) => c.name)).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("drops exactly the 5 known self-collisions", () => {
    const dropped = corpus.meta.droppedCollisions
      .map((c) => `${c.ayah}:${c.position}`)
      .sort();
    expect(dropped).toEqual(["4:1", "50:21", "56:8", "63:16", "8:9"].sort());
  });

  it("leaves no distractor equal to its target", () => {
    const targets = new Map<string, string>();
    for (const w of corpus.words) targets.set(`${w.ayah}:${w.position}`, w.text_uthmani);
    const collisions = corpus.distractors.filter(
      (d) => d.text === targets.get(`${d.ayah}:${d.position}`),
    );
    expect(collisions).toEqual([]);
  });

  it("attestation is a soft check; unattested forms are reported, not fatal", () => {
    const attest = report.checks.find((c) => c.name === "distractor attestation in the Quran")!;
    expect(attest.severity).toBe("soft");
    // ~15% of authored distractors are valid inflections not verbatim in the
    // mushaf — reported for review, but they do not sink the build.
    expect(report.stats.missingFromQuran.length).toBeGreaterThan(0);
    expect(report.ok).toBe(true);
  });

  it("no word falls below 4 distractors; only the 5 dropped words sit at 4", () => {
    const counts = new Map<string, number>();
    for (const d of corpus.distractors) {
      const k = `${d.ayah}:${d.position}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const atFour = [...counts].filter(([, n]) => n === 4).map(([k]) => k);
    const belowFour = [...counts].filter(([, n]) => n < 4);
    expect(belowFour).toEqual([]);
    expect(atFour.sort()).toEqual(["4:1", "50:21", "56:8", "63:16", "8:9"].sort());
  });

  it("has exactly 110 connections", () => {
    expect(corpus.connections.length).toBe(110);
    expect(corpus.connections[0]).toEqual({ from: 1, to: 2 });
    expect(corpus.connections.at(-1)).toEqual({ from: 110, to: 111 });
  });
});

describe("validation fires on injected defects", () => {
  function baseInputs() {
    return {
      verses: structuredClone(inp.verses),
      mcqItems: structuredClone(inp.mcqItems),
      mentalModel: inp.mentalModel,
      morph: inp.qac.yusufMorph,
      generatedFrom: [],
    };
  }

  it("hard-fails when an ayah is missing", () => {
    const bad = baseInputs();
    bad.verses = bad.verses.slice(0, 110); // drop ayah 111
    bad.mcqItems = bad.mcqItems.filter((m) => m.verse !== 111);
    const c: CorpusJson = buildCorpus(bad);
    const r = validateCorpus(c, bad.verses, inp.qac.fullQuranWordSet);
    expect(r.ok).toBe(false);
    expect(r.checks.find((x) => x.name === "ayah count")!.pass).toBe(false);
  });

  it("soft-flags a distractor that is not a Quran word (does not hard-fail)", () => {
    const bad = baseInputs();
    bad.mcqItems[10]!.distractors[0]!.text = "زققققق"; // not a real form
    const c = buildCorpus(bad);
    const r = validateCorpus(c, bad.verses, inp.qac.fullQuranWordSet);
    const attest = r.checks.find((x) => x.name === "distractor attestation in the Quran")!;
    expect(attest.severity).toBe("soft");
    expect(attest.pass).toBe(false);
    // attestation is a soft review flag, so overall validity turns only on hard
    // checks — this defect alone must not fail the build.
    const hardFails = r.checks.filter((x) => x.severity === "hard" && !x.pass);
    expect(hardFails).toEqual([]);
  });

  it("hard-fails when a word is left with fewer than 4 distractors", () => {
    const bad = baseInputs();
    // Force 3 of item 0's distractors to equal the target → dropped → below 4.
    const it0 = bad.mcqItems[0]!;
    it0.distractors[1]!.text = it0.correct;
    it0.distractors[2]!.text = it0.correct;
    const c = buildCorpus(bad);
    const r = validateCorpus(c, bad.verses, inp.qac.fullQuranWordSet);
    expect(r.ok).toBe(false);
    expect(r.checks.find((x) => x.name === "≥4 distractors per word (hard floor)")!.pass).toBe(
      false,
    );
  });
});
