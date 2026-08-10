// The tz-explicit daybound rewrite (build-plan step 8; INVARIANTS.md
// Absolute A's named leak — "v2/daybound.ts:23,49 uses machine-local
// dates, so the same event folds differently in UTC than in Kuala
// Lumpur"). DayConfig now carries an explicit IANA `tz`; dayStart/
// learningDayIndex/isSameLearningDay/daysBetween/anchorTime compute the
// local calendar day AS OBSERVED IN THAT TZ, never the machine's own.
//
// Asia/Kuala_Lumpur is used deliberately: a fixed UTC+8 offset, no DST, so
// the expected boundary is simple arithmetic and the test doesn't depend
// on the container's own clock/zone.

import { describe, expect, it } from "vitest";
import { dayStart, learningDayIndex, isSameLearningDay, daysBetween, anchorTime, type DayConfig } from "../src/daybound.ts";

const HOUR = 3_600_000;
const DAY = 86_400_000;

const KL: DayConfig = { rolloverHour: 4.5, tz: "Asia/Kuala_Lumpur" }; // UTC+8, no DST
const UTC: DayConfig = { rolloverHour: 4.5, tz: "UTC" };

describe("dayStart is tz-explicit, not machine-local", () => {
  it("the same instant produces a DIFFERENT dayStart under different tz configs", () => {
    const now = Date.UTC(2026, 0, 5, 10, 0, 0); // 2026-01-05T10:00:00Z
    const klStart = dayStart(now, KL);
    const utcStart = dayStart(now, UTC);
    expect(klStart).not.toBe(utcStart);
    // KL is UTC+8 — its local calendar day at this instant is 8h ahead,
    // so KL's rollover boundary sits 8h earlier in UTC epoch terms.
    expect(utcStart - klStart).toBe(8 * HOUR);
  });

  it("computes the correct KL rollover boundary by direct arithmetic", () => {
    // 2026-01-05T10:00:00Z = 2026-01-05T18:00:00+08:00 (KL local).
    // rolloverHour 4.5 -> today's KL rollover is 2026-01-05T04:30+08:00
    // = 2026-01-04T20:30:00Z.
    const now = Date.UTC(2026, 0, 5, 10, 0, 0);
    const expected = Date.UTC(2026, 0, 4, 20, 30, 0);
    expect(dayStart(now, KL)).toBe(expected);
  });

  it("UTC config matches the pre-rewrite UTC-pinned golden-log behavior exactly", () => {
    // Same case the golden log's own TZ=UTC pin exercises: T0 anchor from
    // gen-golden-log.ts, well inside a learning day.
    const t0 = Date.UTC(2026, 0, 5, 10, 0, 0);
    expect(dayStart(t0, UTC)).toBe(Date.UTC(2026, 0, 5, 4, 30, 0));
  });
});

describe("the day-boundary pair (INVARIANTS.md's property-pack trigger) under a non-UTC tz", () => {
  it("23:50/00:10 UTC still resolve correctly for a learner whose OWN tz is KL, not UTC", () => {
    // In KL local time, both instants are mid-morning the SAME KL calendar
    // day (23:50 UTC = 07:50+1 KL next day; 00:10 UTC next day = 08:10 KL
    // same day) — same learning-day either way at this rolloverHour, but
    // the boundary must be computed from KL's OWN midnight, not UTC's.
    const day1_2350 = Date.UTC(2026, 0, 10, 23, 50, 0);
    const day2_0010 = Date.UTC(2026, 0, 11, 0, 10, 0);
    expect(isSameLearningDay(day1_2350, day2_0010, KL)).toBe(true);
  });

  it("a pair that's massed in UTC can be SPACED in KL (the exact leak this rewrite closes)", () => {
    // Pick two instants that straddle UTC's rollover but NOT KL's (8h
    // offset shifts where the boundary falls) — proving tz actually
    // changes the massed/spaced classification, not just the label.
    // KL rollover for this UTC day is 2026-01-04T20:30:00Z (04:30+08:00).
    // UTC rollover for the same nominal day is 2026-01-05T04:30:00Z.
    const beforeKlRollover = Date.UTC(2026, 0, 4, 20, 0, 0); // before KL's rollover
    const afterKlRollover = Date.UTC(2026, 0, 4, 21, 0, 0); // after KL's rollover, same UTC day
    expect(isSameLearningDay(beforeKlRollover, afterKlRollover, KL)).toBe(false); // spaced in KL
    expect(isSameLearningDay(beforeKlRollover, afterKlRollover, UTC)).toBe(true); // massed in UTC
  });
});

describe("learningDayIndex / daysBetween / anchorTime are tz-explicit too", () => {
  it("learningDayIndex differs by tz for the same instant, consistently with dayStart", () => {
    const now = Date.UTC(2026, 0, 5, 10, 0, 0);
    expect(learningDayIndex(now, KL)).not.toBe(learningDayIndex(now, UTC));
  });

  it("daysBetween respects the configured tz's own day boundaries", () => {
    const a = Date.UTC(2026, 0, 4, 21, 0, 0); // after KL rollover, before UTC rollover
    const b = Date.UTC(2026, 0, 5, 10, 0, 0);
    expect(daysBetween(a, b, KL)).toBe(0); // same KL learning-day
    expect(daysBetween(a, b, UTC)).toBe(1); // next UTC learning-day
  });

  it("anchorTime resolves within the configured tz's own day", () => {
    const now = Date.UTC(2026, 0, 5, 10, 0, 0);
    const klAnchor = anchorTime(now, KL);
    const utcAnchor = anchorTime(now, UTC);
    expect(klAnchor).not.toBe(utcAnchor);
    expect(utcAnchor - klAnchor).toBe(8 * HOUR);
  });
});

describe("DayConfig.tz is REQUIRED — no silent machine-local fallback", () => {
  it("DEFAULT_DAY_CONFIG carries an explicit tz (UTC), not an implicit one", async () => {
    const { DEFAULT_DAY_CONFIG } = await import("../src/daybound.ts");
    expect(DEFAULT_DAY_CONFIG.tz).toBe("UTC");
  });
});
