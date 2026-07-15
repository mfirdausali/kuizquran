import { describe, expect, it } from "vitest";
import { initAtom } from "../src/atom.ts";
import { scheduleGate, gateDue, applyGateResult, unlockPermitted } from "../src/gate.ts";
import { DEFAULT_DAY_CONFIG } from "../src/daybound.ts";

function local(y: number, mo: number, d: number, h: number): number {
  return new Date(y, mo - 1, d, h, 0, 0, 0).getTime();
}

describe("day-1 cold gate (FR3 / invariant #9)", () => {
  const cfg = DEFAULT_DAY_CONFIG;

  it("scheduling a gate sets it due at the NEXT learning-day start", () => {
    const encodedAt = local(2026, 7, 14, 20); // evening
    const a = scheduleGate({ ...initAtom("ayah", 4), encoded: true }, encodedAt, cfg);
    // next learning-day begins at 2026-07-15 04:30
    expect(a.gateDueAt).toBe(local(2026, 7, 15, 4) + 30 * 60_000);
    expect(a.gatePassed).toBe(false);
  });

  it("gate is not due same day, is due next day", () => {
    const encodedAt = local(2026, 7, 14, 20);
    const a = scheduleGate({ ...initAtom("ayah", 4), encoded: true }, encodedAt, cfg);
    expect(gateDue(a, encodedAt)).toBe(false); // same evening
    expect(gateDue(a, local(2026, 7, 15, 8))).toBe(true); // next morning
  });

  it("a pass marks gatePassed; a fail re-arms for the following day", () => {
    const encodedAt = local(2026, 7, 14, 20);
    let a = scheduleGate({ ...initAtom("ayah", 4), encoded: true }, encodedAt, cfg);
    const attempt = local(2026, 7, 15, 8);
    const passed = applyGateResult(a, true, attempt, cfg);
    expect(passed.gatePassed).toBe(true);
    a = applyGateResult(a, false, attempt, cfg);
    expect(a.gatePassed).toBe(false);
    expect(a.gateDueAt).toBe(local(2026, 7, 16, 4) + 30 * 60_000); // next day
  });

  it("unlock is blocked while any cold gate is due, permitted once passed", () => {
    const encodedAt = local(2026, 7, 14, 20);
    const a = scheduleGate({ ...initAtom("ayah", 4), encoded: true }, encodedAt, cfg);
    const nextMorning = local(2026, 7, 15, 8);
    expect(unlockPermitted([a], nextMorning)).toBe(false); // gate due, not passed
    const passed = applyGateResult(a, true, nextMorning, cfg);
    expect(unlockPermitted([passed], nextMorning)).toBe(true);
  });
});
