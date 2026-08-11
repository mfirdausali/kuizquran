import { describe, expect, it } from "vitest";
import { initAtom } from "../src/atom.ts";
import {
  scheduleGate,
  gateDue,
  applyGateResult,
  unlockPermitted,
  gateForgiveness,
  demoteToLearn,
  RESCAFFOLD_AFTER_FAILS,
  DEMOTE_OFFER_AFTER_FAILS,
} from "../src/gate.ts";
import { DEFAULT_DAY_CONFIG } from "../src/daybound.ts";

// UTC wall clock — matches DEFAULT_DAY_CONFIG.tz, which every test here passes.
// A machine-local constructor would make these assertions offset-dependent.
function atUtc(y: number, mo: number, d: number, h: number): number {
  return Date.UTC(y, mo - 1, d, h, 0, 0, 0);
}

describe("day-1 cold gate (FR3 / invariant #9)", () => {
  const cfg = DEFAULT_DAY_CONFIG;

  it("scheduling a gate sets it due at the NEXT learning-day start", () => {
    const encodedAt = atUtc(2026, 7, 14, 20); // evening
    const a = scheduleGate({ ...initAtom(12, "ayah", 4), encoded: true }, encodedAt, cfg);
    // next learning-day begins at 2026-07-15 04:30
    expect(a.gateDueAt).toBe(atUtc(2026, 7, 15, 4) + 30 * 60_000);
    expect(a.gatePassed).toBe(false);
  });

  it("gate is not due same day, is due next day", () => {
    const encodedAt = atUtc(2026, 7, 14, 20);
    const a = scheduleGate({ ...initAtom(12, "ayah", 4), encoded: true }, encodedAt, cfg);
    expect(gateDue(a, encodedAt)).toBe(false); // same evening
    expect(gateDue(a, atUtc(2026, 7, 15, 8))).toBe(true); // next morning
  });

  it("a pass marks gatePassed; a fail re-arms for the following day", () => {
    const encodedAt = atUtc(2026, 7, 14, 20);
    let a = scheduleGate({ ...initAtom(12, "ayah", 4), encoded: true }, encodedAt, cfg);
    const attempt = atUtc(2026, 7, 15, 8);
    const passed = applyGateResult(a, true, attempt, cfg);
    expect(passed.gatePassed).toBe(true);
    a = applyGateResult(a, false, attempt, cfg);
    expect(a.gatePassed).toBe(false);
    expect(a.gateDueAt).toBe(atUtc(2026, 7, 16, 4) + 30 * 60_000); // next day
  });

  it("unlock is blocked while any cold gate is due, permitted once passed", () => {
    const encodedAt = atUtc(2026, 7, 14, 20);
    const a = scheduleGate({ ...initAtom(12, "ayah", 4), encoded: true }, encodedAt, cfg);
    const nextMorning = atUtc(2026, 7, 15, 8);
    expect(unlockPermitted([a], nextMorning, 12)).toBe(false); // gate due, not passed
    const passed = applyGateResult(a, true, nextMorning, cfg);
    expect(unlockPermitted([passed], nextMorning, 12)).toBe(true);
  });

  // v2-D07 unlock tolerance.
  it("a mode-scoped tolerance permits unlock with pending gates within the band", () => {
    const encodedAt = atUtc(2026, 7, 14, 20);
    const a = scheduleGate({ ...initAtom(12, "ayah", 4), encoded: true }, encodedAt, cfg);
    const nextMorning = atUtc(2026, 7, 15, 8);
    // Steady-style strict (default 0): blocked.
    expect(unlockPermitted([a], nextMorning, 12, 0)).toBe(false);
    // Sprint-style tolerance (1 pending gate tolerated): permitted.
    expect(unlockPermitted([a], nextMorning, 12, 1)).toBe(true);
  });

  it("tolerance is a ceiling: 2 pending gates still blocks a tolerance of 1", () => {
    const encodedAt = atUtc(2026, 7, 14, 20);
    const a = scheduleGate({ ...initAtom(12, "ayah", 4), encoded: true }, encodedAt, cfg);
    const b = scheduleGate({ ...initAtom(12, "ayah", 5), encoded: true }, encodedAt, cfg);
    const nextMorning = atUtc(2026, 7, 15, 8);
    expect(unlockPermitted([a, b], nextMorning, 12, 1)).toBe(false);
  });
});

describe("gate forgiveness ladder (v2-D08)", () => {
  const cfg = DEFAULT_DAY_CONFIG;

  it("a fresh atom is on the normal cold check", () => {
    expect(gateForgiveness(initAtom(12, "ayah", 4))).toBe("cold");
  });

  it("gateFails increments on each fail and resets on a pass", () => {
    const encodedAt = atUtc(2026, 7, 14, 20);
    let a = scheduleGate({ ...initAtom(12, "ayah", 4), encoded: true }, encodedAt, cfg);
    for (let i = 1; i <= 3; i++) {
      a = applyGateResult(a, false, atUtc(2026, 7, 14 + i, 8), cfg);
      expect(a.gateFails).toBe(i);
    }
    const passed = applyGateResult(a, true, atUtc(2026, 7, 18, 8), cfg);
    expect(passed.gateFails).toBe(0);
  });

  it(`rescaffolds to a lighter S2 re-teach after ${RESCAFFOLD_AFTER_FAILS} fails`, () => {
    const atom = { ...initAtom(12, "ayah", 4), encoded: true, gateFails: RESCAFFOLD_AFTER_FAILS };
    expect(gateForgiveness(atom)).toBe("rescaffold");
  });

  it(`offers demote-to-Learn after ${DEMOTE_OFFER_AFTER_FAILS} fails`, () => {
    const atom = { ...initAtom(12, "ayah", 4), encoded: true, gateFails: DEMOTE_OFFER_AFTER_FAILS };
    expect(gateForgiveness(atom)).toBe("demote");
  });

  it("demoteToLearn clears encoding/gate state but never zeroes strength (re-learned, not abandoned)", () => {
    const atom = {
      ...initAtom(12, "ayah", 4),
      encoded: true,
      gatePassed: false,
      gateDueAt: atUtc(2026, 7, 15, 8),
      gateFails: DEMOTE_OFFER_AFTER_FAILS,
      strength: 22,
    };
    const demoted = demoteToLearn(atom);
    expect(demoted.encoded).toBe(false);
    expect(demoted.gateDueAt).toBeNull();
    expect(demoted.gatePassed).toBe(false);
    expect(demoted.gateFails).toBe(0);
    expect(demoted.strength).toBe(22); // evidence kept, not reset to zero
  });
});
