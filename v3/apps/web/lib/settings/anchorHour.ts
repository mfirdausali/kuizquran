"use client";

// THE DAILY ANCHOR HOUR — a secular preferred time of day the learner picks
// for their own reference (never a prayer name, D16/D34's naming rule).
//
// `AuthController::anonymous()`/`login()`/`me()` have returned `anchorHour`
// on every identity response since the Laravel skeleton landed (build-plan
// step 13), and `apiFetch.ts#AnonymousIdentity` has declared the field for
// just as long — but nothing under `apps/web` ever READ it, and there was no
// server route to CHANGE it either. `SettingsController` (v3-D140) is the
// new write half; this module is the client for it, mirroring
// `lib/account/api.ts`'s never-throws, typed-result discipline exactly.
//
// Deliberately NOT threaded into `lib/onboarding/choices.ts`: that type's own
// header is explicit — "every member has to name the engine function that
// consumes it" — and `daybound.ts#anchorTime()` (the only reader of
// `cfg.anchorHour` anywhere in `packages/engine/src`) does not change what
// the scheduler does tomorrow. This stays a Settings-only preference, not an
// onboarding question. See DECISIONS.md v3-D140.
//
// EGRESS: through `apiFetch` only (check-boundaries.mjs clause 6).

import { apiFetch } from "@/lib/sync/apiFetch.ts";

/** A short list of friendly anchor times (hour of day, 24h; half-hours
 *  allowed) — ported verbatim from v2's `session/anchor.ts#ANCHOR_CHOICES`.
 *  Secular on purpose: no prayer names (D16/D34). */
export const ANCHOR_CHOICES: { label: string; hour: number }[] = [
  { label: "Early morning", hour: 5.5 },
  { label: "After breakfast", hour: 8 },
  { label: "Midday", hour: 13 },
  { label: "Late afternoon", hour: 17 },
  { label: "Evening", hour: 20 },
  { label: "Before sleep", hour: 22.5 },
];

export type AnchorHourResult =
  | { state: "ok"; anchorHour: number }
  | { state: "failed"; reason: string };

function requestFailed(err: unknown): { state: "failed"; reason: string } {
  return {
    state: "failed",
    reason: err instanceof Error ? `request failed: ${err.message}` : "request failed",
  };
}

function parseAnchorHour(body: unknown): AnchorHourResult {
  if (
    typeof body !== "object" ||
    body === null ||
    !("anchorHour" in body) ||
    typeof (body as { anchorHour: unknown }).anchorHour !== "number"
  ) {
    return { state: "failed", reason: "the API's answer carried no anchorHour" };
  }
  return { state: "ok", anchorHour: (body as { anchorHour: number }).anchorHour };
}

/** Read the caller's own current anchor hour. Never throws. */
export async function fetchAnchorHour(): Promise<AnchorHourResult> {
  let response: Response;
  try {
    response = await apiFetch("/api/settings");
  } catch (err) {
    return requestFailed(err);
  }
  if (!response.ok) return { state: "failed", reason: `the API answered ${response.status}` };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { state: "failed", reason: "the API's answer was not JSON" };
  }
  return parseAnchorHour(body);
}

/** Set a new anchor hour (0–24, half-hours allowed — the server is the one
 *  validator, this never re-derives the range check). Never throws. */
export async function updateAnchorHour(hour: number): Promise<AnchorHourResult> {
  let response: Response;
  try {
    response = await apiFetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ anchorHour: hour }),
    });
  } catch (err) {
    return requestFailed(err);
  }
  if (!response.ok) {
    let reason = `the API answered ${response.status}`;
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === "string") reason = body.error;
    } catch {
      // fall through to the status-code reason above
    }
    return { state: "failed", reason };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { state: "failed", reason: "the API's answer was not JSON" };
  }
  return parseAnchorHour(body);
}
