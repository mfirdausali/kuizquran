import { describe, expect, it } from "vitest";
import { summarizeSession, formatDuration, greetingForHour } from "../src/sessionSummary.ts";
import { DEFAULT_DAY_CONFIG } from "../src/daybound.ts";
import type { DrillEvent } from "../src/types.ts";

// Minimal event factory — only the fields summarizeSession reads.
function ev(p: Partial<DrillEvent> & { type: DrillEvent["type"]; ts: number }): DrillEvent {
  return { surah: 12, ayah: 4, rung: "S1", ...p } as DrillEvent;
}

describe("summarizeSession", () => {
  it("duration = last tap − session_start", () => {
    const s = summarizeSession([
      ev({ type: "session_start", ts: 1000 }),
      ev({ type: "tap", ts: 3000, correct: true }),
      ev({ type: "tap", ts: 9200, correct: true }),
    ]);
    expect(s.durationMs).toBe(8200);
  });

  it("recall = correct ÷ graded taps", () => {
    const s = summarizeSession([
      ev({ type: "session_start", ts: 0 }),
      ev({ type: "tap", ts: 1, correct: true }),
      ev({ type: "tap", ts: 2, correct: true }),
      ev({ type: "tap", ts: 3, correct: false }),
      ev({ type: "tap", ts: 4, correct: true }),
    ]);
    expect(s.recall).toBeCloseTo(3 / 4);
  });

  it("excludes pretest first-pass meaning errors from recall (invariant #3)", () => {
    const s = summarizeSession([
      ev({ type: "session_start", ts: 0 }),
      ev({ type: "tap", ts: 1, correct: false, pretest: true }), // excluded
      ev({ type: "tap", ts: 2, correct: true }),
      ev({ type: "tap", ts: 3, correct: true }),
    ]);
    expect(s.recall).toBe(1); // 2/2, the pretest miss is not counted
  });

  it("excludes free-play (structured:false) taps from recall (invariant #4/#5)", () => {
    const s = summarizeSession([
      ev({ type: "session_start", ts: 0 }),
      ev({ type: "tap", ts: 1, correct: false, structured: false }), // free play, excluded
      ev({ type: "tap", ts: 2, correct: true }),
    ]);
    expect(s.recall).toBe(1); // only the one graded tap counts
  });

  it("counts WHOLE ayat, de-duplicated, in completion order (invariant #1)", () => {
    const s = summarizeSession([
      ev({ type: "session_start", ts: 0 }),
      ev({ type: "tap", ts: 1, correct: true }),
      ev({ type: "ayah_complete", ts: 2, ayah: 1 }),
      ev({ type: "ayah_complete", ts: 3, ayah: 2 }),
      ev({ type: "ayah_complete", ts: 4, ayah: 2 }), // dup, ignored
    ]);
    expect(s.ayatCompleted).toBe(2);
    expect(s.ayatRefs).toEqual([1, 2]);
  });

  it("folds the v2 drill vocabulary (reconstruct_tap / ayah_produced) identically", () => {
    // The live drill emits these, not the legacy tap/ayah_complete — the summary
    // must count them the same way, or the session-end screen shows all zeros.
    const s = summarizeSession([
      ev({ type: "session_start", ts: 1000 }),
      ev({ type: "reconstruct_tap", ts: 2000, correct: true, structured: true }),
      ev({ type: "reconstruct_tap", ts: 3000, correct: false, structured: true }),
      ev({ type: "reconstruct_tap", ts: 4000, correct: true, structured: true }),
      ev({ type: "ayah_produced", ts: 4500, ayah: 1, rung: "S3" }),
      ev({ type: "reconstruct_tap", ts: 6000, correct: true, structured: true }),
      ev({ type: "ayah_produced", ts: 7200, ayah: 2, rung: "S2" }),
    ]);
    expect(s.durationMs).toBe(6200); // 7200 − 1000
    expect(s.recall).toBeCloseTo(3 / 4); // 3 correct of 4 graded taps
    expect(s.ayatCompleted).toBe(2);
    expect(s.ayatRefs).toEqual([1, 2]);
    expect(s.taps).toBe(4);
  });

  it("recall is null when there are no graded taps (pure gate/chain session)", () => {
    const s = summarizeSession([
      ev({ type: "session_start", ts: 0 }),
      ev({ type: "chain_step", ts: 1, correct: true }),
      ev({ type: "ayah_complete", ts: 2, ayah: 1 }),
    ]);
    expect(s.recall).toBeNull();
    expect(s.ayatCompleted).toBe(1);
  });

  it("counts a PASSED gate_result as one completed ayah (B11: a gate-only session's whole point was completing that ayah's check)", () => {
    // A session whose ONLY due item is a cold gate emits no ayah_produced/
    // ayah_complete at all — the gate branch commits gate_result exclusively
    // (v3-D101/B11). Before this fix the summary screen read "0 ayat" for a
    // learner who just passed their gate — real work, reported as nothing.
    const s = summarizeSession([
      ev({ type: "session_start", ts: 1000 }),
      ev({ type: "reconstruct_tap", ts: 2000, correct: true, structured: true }),
      ev({ type: "reconstruct_tap", ts: 3000, correct: true, structured: true }),
      ev({ type: "gate_result", ts: 4000, ayah: 7, correct: true }),
    ]);
    expect(s.ayatCompleted).toBe(1);
    expect(s.ayatRefs).toEqual([7]);
    expect(s.durationMs).toBe(3000); // last tap ts (4000) − session_start (1000)
  });

  it("does NOT count a FAILED gate_result — the gate was not passed", () => {
    const s = summarizeSession([
      ev({ type: "session_start", ts: 0 }),
      ev({ type: "gate_result", ts: 1000, ayah: 7, correct: false }),
    ]);
    expect(s.ayatCompleted).toBe(0);
    expect(s.ayatRefs).toEqual([]);
  });

  it("de-duplicates a passed gate_result against an ayah already produced this same session (rescaffold warm-up, v2-D08)", () => {
    // The rescaffold warm-up commits an ordinary S2 ayah_produced for the SAME
    // ayah before the real cold check's own gate_result — both name ayah 7,
    // and it is still exactly one completed ayah, not two.
    const s = summarizeSession([
      ev({ type: "session_start", ts: 0 }),
      ev({ type: "ayah_produced", ts: 1000, ayah: 7, rung: "S2" }),
      ev({ type: "gate_result", ts: 2000, ayah: 7, correct: true }),
    ]);
    expect(s.ayatCompleted).toBe(1);
    expect(s.ayatRefs).toEqual([7]);
  });

  it("greeting is derived from the session_start hour", () => {
    const morning = summarizeSession([ev({ type: "session_start", ts: 100 })], DEFAULT_DAY_CONFIG, () => 8);
    const night = summarizeSession([ev({ type: "session_start", ts: 100 })], DEFAULT_DAY_CONFIG, () => 23);
    expect(morning.greeting).toBe("morning");
    expect(night.greeting).toBe("night");
  });

  it("empty / tapless session has zero duration and null recall", () => {
    const s = summarizeSession([ev({ type: "session_start", ts: 5000 })]);
    expect(s.durationMs).toBe(0);
    expect(s.recall).toBeNull();
    expect(s.ayatCompleted).toBe(0);
  });
});

describe("greetingForHour buckets", () => {
  it("maps hours to buckets", () => {
    expect(greetingForHour(6)).toBe("morning");
    expect(greetingForHour(13)).toBe("afternoon");
    expect(greetingForHour(19)).toBe("evening");
    expect(greetingForHour(2)).toBe("night");
    expect(greetingForHour(23)).toBe("night");
  });
});

describe("formatDuration", () => {
  it("formats m:ss with zero-padded seconds", () => {
    expect(formatDuration(492000)).toBe("8:12");
    expect(formatDuration(65000)).toBe("1:05");
    expect(formatDuration(45000)).toBe("0:45");
    expect(formatDuration(0)).toBe("0:00");
  });
});
