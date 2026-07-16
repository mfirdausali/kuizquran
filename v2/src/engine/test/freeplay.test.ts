import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extraLearnGrant,
  weakSpots,
  openPracticePick,
  coldSuccessAdoption,
  diminishingReturns,
} from "../src/freeplay.ts";
import { initAtom, type AtomState } from "../src/atom.ts";
import { scheduleGate } from "../src/gate.ts";
import type { Corpus } from "../src/types.ts";
import { update, type RetrievalOutcome } from "../src/update.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  readFileSync(resolve(HERE, "../../../public/corpus/12.json"), "utf8"),
) as Corpus;
const DAY = 86_400_000;
const wc = new Map<number, number>([[4, 15], [5, 12], [6, 20]]);

function encoded(ref: number, extra: Partial<AtomState> = {}): AtomState {
  return { ...initAtom("ayah", ref), encoded: true, gatePassed: true, strength: 50, stability: 4, lastRetrieval: 3 * DAY, ...extra };
}

describe("Door 1 — extraLearnGrant (gate intact)", () => {
  it("grants the next un-encoded candidate with a disclosed cost", () => {
    const g = extraLearnGrant([encoded(4)], [4, 5, 6], 10 * DAY, wc);
    expect(g.granted).toBe(true);
    expect(g.ayah).toBe(5); // 4 is encoded → next is 5
    expect(g.costMin).toBeCloseTo(0.33 * 12, 1);
  });

  it("does NOT grant while a cold gate is due (gate intact)", () => {
    const gated = scheduleGate({ ...initAtom("ayah", 4), encoded: true }, 5 * DAY, undefined);
    const g = extraLearnGrant([gated], [4, 5], 6 * DAY, wc); // gate due next day
    expect(g.granted).toBe(false);
    expect(g.reason).toMatch(/gate/);
  });
});

describe("Door 2 — weakSpots", () => {
  it("ranks encoded atoms by forgetting risk, weakest first", () => {
    const fresh = encoded(4, { lastRetrieval: 9 * DAY, stability: 10 }); // low risk
    const stale = encoded(5, { lastRetrieval: 1 * DAY, stability: 2 }); // high risk
    const spots = weakSpots([fresh, stale], 10 * DAY);
    expect(spots[0]!.ref).toBe(5); // weakest first
    expect(spots[0]!.risk).toBeGreaterThan(spots[1]!.risk);
  });
});

describe("Door 3 — openPracticePick", () => {
  it("validates the ayah exists", () => {
    expect(openPracticePick(corpus, 4, "S3").valid).toBe(true);
    expect(openPracticePick(corpus, 999, "S1").valid).toBe(false);
  });
});

describe("cold-success adoption", () => {
  it("offers adoption on a cold S3/chain pass of an UNTAUGHT ayah", () => {
    const atoms = [encoded(4)]; // ayah 4 taught, ayah 7 untaught
    expect(coldSuccessAdoption(atoms, 7, "S3", true).offer).toBe(true);
    expect(coldSuccessAdoption(atoms, 7, "chain", true).offer).toBe(true);
  });
  it("does NOT offer on an easy drill, a wrong answer, or an already-taught ayah", () => {
    const atoms = [encoded(4)];
    expect(coldSuccessAdoption(atoms, 7, "S1", true).offer).toBe(false); // easy
    expect(coldSuccessAdoption(atoms, 7, "S3", false).offer).toBe(false); // wrong
    expect(coldSuccessAdoption(atoms, 4, "S3", true).offer).toBe(false); // already taught
  });
});

describe("free-play is lifecycle-neutral (invariant #5)", () => {
  it("a structured:false outcome does not move the atom", () => {
    const atom = encoded(4);
    const outcome: RetrievalOutcome = { kind: "s3", correct: true, ts: 10 * DAY, structured: false };
    expect(update(atom, outcome)).toEqual(atom); // no-op
  });
});

describe("diminishing-returns line", () => {
  it("nudges after ~4 same-day reps", () => {
    expect(diminishingReturns(3)).toBeNull();
    expect(diminishingReturns(4)).toMatch(/spacing/);
  });
});
