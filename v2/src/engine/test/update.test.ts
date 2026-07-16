import { describe, expect, it } from "vitest";
import { initAtom, bandOf } from "../src/atom.ts";
import { update, type RetrievalOutcome } from "../src/update.ts";

const DAY = 86_400_000;
function out(o: Partial<RetrievalOutcome> & { ts: number }): RetrievalOutcome {
  return { kind: "s2", correct: true, structured: true, ...o };
}

describe("update() — invariant #4: errors carry full weight", () => {
  it("errors never raise strength (property)", () => {
    // Random-ish sweep of starting strengths and kinds.
    const kinds = ["s1", "s2", "s3", "gate", "review"] as const;
    for (let s = 0; s <= 100; s += 7) {
      for (const kind of kinds) {
        const atom = { ...initAtom("ayah", 4), strength: s, stability: 5, lastRetrieval: 0 };
        const after = update(atom, out({ kind, correct: false, ts: 10 * DAY }));
        expect(after.strength).toBeLessThanOrEqual(atom.strength);
      }
    }
  });

  it("a lapse from an established band damps stability but never zeroes it", () => {
    const atom = { ...initAtom("ayah", 4), strength: 85, stability: 20, lastRetrieval: 0 };
    const after = update(atom, out({ kind: "review", correct: false, ts: 30 * DAY }));
    expect(after.lapses).toBe(1);
    expect(after.stability).toBeGreaterThan(0); // sabr jameel — not reset to zero
    expect(after.stability).toBeLessThan(atom.stability); // but damped
    expect(after.strength).toBeLessThan(atom.strength);
  });
});

describe("update() — invariant #4: massed successes damped", () => {
  it("same-day repeat successes plateau (diminishing, bounded) (property)", () => {
    let atom = { ...initAtom("ayah", 4), lastRetrieval: null as number | null };
    const ts0 = 5 * DAY + 6 * 3600_000; // mid-morning, one learning-day
    let prevGain = Infinity;
    const gains: number[] = [];
    for (let i = 0; i < 6; i++) {
      const before = atom.strength;
      atom = update(atom, out({ kind: "s2", correct: true, ts: ts0 + i * 60_000 }));
      const gain = atom.strength - before;
      gains.push(gain);
    }
    // Strength is monotonic up but bounded ≤100, and same-day gains are damped
    // relative to a spaced gain.
    expect(atom.strength).toBeLessThanOrEqual(100);
    // The FIRST rep of the day (lastRetrieval was null) is un-massed; subsequent
    // same-day reps are damped → smaller.
    expect(gains[1]!).toBeLessThan(gains[0]!);
  });

  it("a spaced success is worth more than a massed one", () => {
    const base = { ...initAtom("ayah", 4), strength: 20, stability: 3, lastRetrieval: 5 * DAY };
    const massed = update(base, out({ kind: "s2", correct: true, ts: 5 * DAY + 60_000 }));
    const spaced = update(base, out({ kind: "s2", correct: true, ts: 8 * DAY }));
    expect(spaced.strength - base.strength).toBeGreaterThan(massed.strength - base.strength);
  });
});

describe("update() — invariant #3: pretest exclusion", () => {
  it("a first-pass meaning error (pretest) does not change the atom at all", () => {
    const atom = { ...initAtom("ayah", 4), strength: 30, stability: 4, lastRetrieval: 0 };
    const after = update(atom, out({ kind: "s1", correct: false, pretest: true, ts: 2 * DAY }));
    expect(after).toEqual(atom); // untouched
  });
});

describe("update() — invariant #5: only structured session mutates lifecycle", () => {
  it("free-play (unstructured) outcomes do not move strength", () => {
    const atom = { ...initAtom("ayah", 4), strength: 50, stability: 6, lastRetrieval: 0 };
    const after = update(atom, out({ kind: "s2", correct: true, structured: false, ts: 9 * DAY }));
    expect(after).toEqual(atom);
  });
});

describe("update() — encoding + bands", () => {
  it("an S3 or gate success marks the atom encoded", () => {
    let atom = initAtom("ayah", 4);
    atom = update(atom, out({ kind: "s3", correct: true, ts: DAY }));
    expect(atom.encoded).toBe(true);
  });

  it("strength climbs through the bands with clean spaced reps", () => {
    let atom = initAtom("ayah", 4);
    let ts = DAY;
    const stages: string[] = [];
    for (let i = 0; i < 8; i++) {
      atom = update(atom, out({ kind: "s3", correct: true, ts }));
      stages.push(bandOf(atom.strength));
      ts += 2 * DAY; // spaced
    }
    expect(stages[0]).toBe("learn");
    expect(atom.strength).toBeGreaterThanOrEqual(80); // reaches carry
    expect(bandOf(atom.strength)).toBe("carry");
  });
});
