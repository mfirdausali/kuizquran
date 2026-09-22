// clockSkew.ts — edge case #111's own third clause, quoted verbatim by
// `merge.ts#FUTURE_TS_TOLERANCE_MS`'s own docblock and left unbuilt by both
// v3-D240 (the per-event flag) and v3-D242 (the fold-side clamp): "skew
// measured client-now vs server-now, not per-event."
//
// This is a device-level measurement, not an event-level one — see
// clockSkew.ts's own header for why the two are genuinely different facts.

import { describe, expect, it } from "vitest";
import { CLOCK_SKEW_ALERT_MS, measureClockSkew } from "./clockSkew.ts";

const NOW = 1_700_000_000_000; // a whole-second epoch, so Date-header rounding is exact.

function responseWithDate(headerMs: number | null): Response {
  const headers: Record<string, string> = {};
  if (headerMs !== null) headers["Date"] = new Date(headerMs).toUTCString();
  return new Response("{}", { status: 200, headers });
}

describe("measureClockSkew()", () => {
  it("is POSITIVE when this device's clock is AHEAD of the server's", () => {
    // The server's own Date header says 30s earlier than our `now` — this
    // device is running fast.
    const response = responseWithDate(NOW - 30_000);
    expect(measureClockSkew(response, NOW)).toBe(30_000);
  });

  it("is NEGATIVE when this device's clock is BEHIND the server's", () => {
    const response = responseWithDate(NOW + 45_000);
    expect(measureClockSkew(response, NOW)).toBe(-45_000);
  });

  it("is exactly zero when the two clocks genuinely agree", () => {
    const response = responseWithDate(NOW);
    expect(measureClockSkew(response, NOW)).toBe(0);
  });

  it("degrades to null, never a fabricated 0, when the response carries no Date header", () => {
    // The Fetch `Response` constructor never sets this header on its own — a
    // real server always does (RFC 9110 §6.6.1), but a stub that forgot to,
    // or a proxy that strips it, must not be silently read as "no skew".
    const response = responseWithDate(null);
    expect(measureClockSkew(response, NOW)).toBeNull();
  });

  it("degrades to null when the Date header is present but unparseable", () => {
    const response = new Response("{}", { status: 200, headers: { Date: "not a date" } });
    expect(measureClockSkew(response, NOW)).toBeNull();
  });
});

describe("CLOCK_SKEW_ALERT_MS", () => {
  it("is two orders of magnitude below merge.ts's FUTURE_TS_TOLERANCE_MS — meant to notice long before that threshold, not at it", async () => {
    const { FUTURE_TS_TOLERANCE_MS } = await import("./merge.ts");
    expect(CLOCK_SKEW_ALERT_MS).toBeLessThan(FUTURE_TS_TOLERANCE_MS / 100);
  });
});
