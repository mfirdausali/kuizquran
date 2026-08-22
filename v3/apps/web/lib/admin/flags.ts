"use client";

// THE FLAG PLANE CLIENT (build-plan step 26, M8) — the missing frontend half
// of `Admin\FlagController`.
//
// The backend (`GET /api/admin/flags`, `POST /api/admin/flags/{key}/kill`,
// `POST /api/admin/flags/{key}/enable`, `POST /api/admin/flags/{key}/ack`)
// has existed since the flag plane shipped, fully tested
// (`tests/Feature/Flags/FlagPlaneTest.php`, 13 tests covering #126's
// kill-always-wins race, #127's cache bust, #159's ack-never-re-enables, and
// the M10 security-review versionless-ramp fix) — but nothing under
// `apps/web` ever called it. `grep -rln "admin/flags" apps/web` (excluding
// this module and its own tests) returned nothing. The same
// "built + tested + zero production callers" shape as v3-D100's
// `SystemHealthController` and v3-D124's `ContentFreezeController` findings
// — see CLAUDE.md's own "next unswept layer" note pointing at this exact
// controller.
//
// EGRESS: through `apiFetch` only (check-boundaries.mjs clause 6).
//
// THE CEREMONY IS SERVER-ENFORCED, NOT HERE. `FlagController::enable()`'s
// own docblock: "a ceremony enforced only in the admin UI is bypassable with
// one curl command." This module carries the ceremony fields to the server
// and reports back exactly what the server decided (422 field errors, a 409
// version conflict) — it does not re-implement any of the >=20-char reason
// check, the verbatim-name check, or the two booleans. A client-side copy of
// those rules would be either redundant (if kept in sync) or a lie (the
// moment it drifts), and BUILD-PLAN's own "SERVER-ENFORCED" is precisely the
// promise that a lie here cannot matter.
//
// FAILURE IS A STATE, NOT AN EXCEPTION — same reasoning as `loadHealth` and
// `loadContentFreeze`.

import { apiFetch } from "@/lib/sync/apiFetch.ts";

export interface FlagRow {
  key: string;
  description: string;
  enabled: boolean;
  version: number;
  killedAt: string | null;
  bannerVisible: boolean;
  ackAt: string | null;
  ackAutoWaived: boolean;
}

export type FlagsLoad =
  | { state: "loading" }
  | { state: "ready"; flags: FlagRow[] }
  /** The API could not be reached or did not answer with a usable body.
   *  Never painted as "no flags exist" — that would look like a real,
   *  observed reading, when in fact nothing was read at all. */
  | { state: "unavailable"; reason: string };

function isFlagRow(v: unknown): v is FlagRow {
  if (typeof v !== "object" || v === null) return false;
  const f = v as Record<string, unknown>;
  return (
    typeof f.key === "string" &&
    typeof f.description === "string" &&
    typeof f.enabled === "boolean" &&
    typeof f.version === "number" &&
    (typeof f.killedAt === "string" || f.killedAt === null) &&
    typeof f.bannerVisible === "boolean" &&
    (typeof f.ackAt === "string" || f.ackAt === null) &&
    typeof f.ackAutoWaived === "boolean"
  );
}

/**
 * Fetch every flag's current state. Never throws — every failure (network,
 * non-2xx, unparseable body, a body missing the contract's fields) becomes
 * `unavailable` with a reason an operator can act on, exactly as `loadHealth`.
 */
export async function loadFlags(): Promise<FlagsLoad> {
  let response: Response;
  try {
    response = await apiFetch("/api/admin/flags");
  } catch (err) {
    return {
      state: "unavailable",
      reason: err instanceof Error ? `request failed: ${err.message}` : "request failed",
    };
  }

  if (!response.ok) {
    return {
      state: "unavailable",
      reason:
        response.status === 403
          ? "this screen requires an admin account"
          : `the API answered ${response.status}`,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { state: "unavailable", reason: "the API's answer was not JSON" };
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("flags" in body) ||
    !Array.isArray((body as Record<string, unknown>).flags) ||
    !((body as Record<string, unknown>).flags as unknown[]).every(isFlagRow)
  ) {
    return { state: "unavailable", reason: "the API's answer carried no flag list" };
  }

  return { state: "ready", flags: (body as { flags: FlagRow[] }).flags };
}

export interface FlagActionOutcome {
  ok: boolean;
  message: string;
  /** Present only on a 422 ceremony-incomplete response — the server's own
   *  per-field errors, never re-derived client-side. */
  errors?: Record<string, string>;
}

async function readErrorBody(response: Response): Promise<{ error?: unknown; errors?: unknown }> {
  try {
    const body = await response.json();
    return typeof body === "object" && body !== null ? (body as { error?: unknown; errors?: unknown }) : {};
  } catch {
    return {};
  }
}

/**
 * KILL — one click, unconditional. Never throws; a network failure becomes a
 * non-ok outcome with a human-readable message, same discipline as
 * `rebuildAtomCache`.
 */
export async function killFlag(key: string): Promise<FlagActionOutcome> {
  let response: Response;
  try {
    response = await apiFetch(`/api/admin/flags/${encodeURIComponent(key)}/kill`, { method: "POST" });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? `request failed: ${err.message}` : "request failed" };
  }

  if (!response.ok) {
    const body = await readErrorBody(response);
    return {
      ok: false,
      message: typeof body.error === "string" ? body.error : `the API answered ${response.status}`,
    };
  }

  return { ok: true, message: "killed" };
}

export interface EnableCeremonyInput {
  reason: string;
  typedFlagName: string;
  acknowledgesRetentionRisk: boolean;
  acknowledgesNoDarkPattern: boolean;
  /** The flag version this operator last READ — carried so a concurrent kill
   *  cannot be silently overwritten (#126, the M10 security-review fix). */
  version: number;
}

/**
 * ENABLE-HARD — posts the full ceremony. The server is the sole judge of
 * whether it is complete; this function only shapes the request and reports
 * the response back, snake_cased for the Laravel contract.
 */
export async function enableFlag(key: string, input: EnableCeremonyInput): Promise<FlagActionOutcome> {
  let response: Response;
  try {
    response = await apiFetch(`/api/admin/flags/${encodeURIComponent(key)}/enable`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: input.reason,
        typed_flag_name: input.typedFlagName,
        acknowledges_retention_risk: input.acknowledgesRetentionRisk,
        acknowledges_no_dark_pattern: input.acknowledgesNoDarkPattern,
        version: input.version,
      }),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? `request failed: ${err.message}` : "request failed" };
  }

  if (!response.ok) {
    const body = await readErrorBody(response);
    const errors =
      typeof body.errors === "object" && body.errors !== null
        ? (body.errors as Record<string, unknown>)
        : undefined;
    return {
      ok: false,
      message: typeof body.error === "string" ? body.error : `the API answered ${response.status}`,
      errors: errors
        ? Object.fromEntries(Object.entries(errors).filter((e): e is [string, string] => typeof e[1] === "string"))
        : undefined,
    };
  }

  return { ok: true, message: "enabled" };
}

/** Acknowledge a kill. Never claims a re-enable (#159) — the outcome message
 *  is neutral regardless of the server's `enabled` field. */
export async function acknowledgeFlag(key: string): Promise<FlagActionOutcome> {
  let response: Response;
  try {
    response = await apiFetch(`/api/admin/flags/${encodeURIComponent(key)}/ack`, { method: "POST" });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? `request failed: ${err.message}` : "request failed" };
  }

  if (!response.ok) {
    const body = await readErrorBody(response);
    return {
      ok: false,
      message: typeof body.error === "string" ? body.error : `the API answered ${response.status}`,
    };
  }

  return { ok: true, message: "acknowledged" };
}
