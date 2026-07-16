import { describe, expect, it } from "vitest";
import { summarizeSession, formatDuration, greetingForHour } from "../src/sessionSummary.ts";
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

  it("recall is null when there are no graded taps (pure gate/chain session)", () => {
    const s = summarizeSession([
      ev({ type: "session_start", ts: 0 }),
      ev({ type: "chain_step", ts: 1, correct: true }),
      ev({ type: "ayah_complete", ts: 2, ayah: 1 }),
    ]);
    expect(s.recall).toBeNull();
    expect(s.ayatCompleted).toBe(1);
  });

  it("greeting is derived from the session_start hour", () => {
    const morning = summarizeSession([ev({ type: "session_start", ts: 100 })], () => 8);
    const night = summarizeSession([ev({ type: "session_start", ts: 100 })], () => 23);
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
