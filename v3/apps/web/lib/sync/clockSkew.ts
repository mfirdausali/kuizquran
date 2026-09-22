"use client";

// Edge case #111's own third clause — the one `merge.ts#FUTURE_TS_TOLERANCE_MS`
// already quotes verbatim and neither v3-D240 nor v3-D242 built:
//
//     "Far-future client ts | be | permanent spacing poison | accept + flag;
//      fold clamps spacing at received_at; skew measured client-now vs
//      server-now, not per-event".
//
// The first two clauses are about ONE EVENT's own `ts` — a per-event fact.
// v3-D240 flags a pulled event whose `ts` sits implausibly far in this
// device's future (`merge.ts#futureTs`); v3-D242 clamps the FOLD's own
// spacing arithmetic at `received_at` so a poisoned `ts` can never inflate a
// retrieval interval. Both are reactions to a bad EVENT.
//
// This clause is a different measurement, and the register's own wording says
// so precisely: "client-now vs server-now, NOT per-event". It is not derived
// from any event's contents at all — a device whose clock is wrong but has
// simply never yet pulled or pushed a poisoned-looking event (because it
// hasn't drilled anything, or because the skew is real but still under
// `FUTURE_TS_TOLERANCE_MS`, a full year) would never trip either of the first
// two clauses, yet its clock is still wrong RIGHT NOW. This measures that
// directly, from the transport layer, on every sync cycle, independent of
// whether any particular event happens to carry a bad timestamp.
//
// THE MECHANISM: every HTTP response carries a standard `Date` response
// header (RFC 9110 §6.6.1) — a timestamp the SERVER stamps at the moment it
// wrote the response. No new endpoint, no new wire field, nothing added to
// any event or response BODY. `measureClockSkew` reads it back and compares
// it against the caller's own `now`. Positive means this device's clock is
// AHEAD of the server; negative means BEHIND. `null` when the header is
// absent or unparseable (a test double that never sets it, or a proxy that
// strips it) — never a fabricated `0`, since "could not measure" and
// "measured zero skew" are different facts and must not collapse into one.
//
// This is a COARSE signal, not a precision clock sync (no round-trip-time
// correction is attempted — that is NTP's job, not this app's). `Date`
// headers are second-resolution, and network latency between the server
// stamping the header and this device reading it adds noise on the order of
// hundreds of milliseconds at most on an ordinary connection. `CLOCK_SKEW_ALERT_MS`
// is set two orders of magnitude below `FUTURE_TS_TOLERANCE_MS` specifically so
// this notices a badly-set clock LONG before it could ever poison an event's
// own spacing, not to flag ordinary transport noise.

/**
 * How far ahead (positive) or behind (negative) this device's clock is from
 * the server's, measured from one HTTP response's own `Date` header against
 * the caller's own `now`. `null` when the header is missing or unparseable —
 * never a fabricated `0`.
 */
export function measureClockSkew(response: Response, now: number): number | null {
  const header = response.headers.get("Date");
  if (header === null) return null;
  const serverMs = Date.parse(header);
  if (Number.isNaN(serverMs)) return null;
  return now - serverMs;
}

/**
 * Worth a learner's attention past this magnitude. Generous on purpose: an
 * ordinary device drifts by seconds, not minutes, and the `Date`-header
 * transport itself adds well under a second of noise — five minutes is
 * comfortably past either. Two orders of magnitude below
 * `FUTURE_TS_TOLERANCE_MS` (`merge.ts`, one year), so this is meant to catch a
 * skew long before it could ever reach the threshold that poisons an event's
 * own spacing.
 */
export const CLOCK_SKEW_ALERT_MS = 5 * 60 * 1000;
