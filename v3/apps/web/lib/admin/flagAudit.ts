"use client";

// THE FLAG AUDIT VIEWER CLIENT (build-plan step 26, M8) — the missing
// frontend half of `Admin\FlagAuditController`.
//
// `flag_ramp_audit` has been written by `FlagService::kill`/`ramp`/
// `acknowledgeKill` (including the unattended nightly `autoWaiveDueKills`
// scheduler) since the flag plane shipped and read by nothing under
// `apps/web` — the same "built + populated + zero read surface" shape
// v3-D125 named for this exact table (deferred there as a separate,
// smaller finding) and v3-D129 fixed for `AdminAudit`/`lib/admin/audit.ts`,
// this module's direct template.
//
// EGRESS: through `apiFetch` only (check-boundaries.mjs clause 6).
//
// FAILURE IS A STATE, NOT AN EXCEPTION — same discipline as `loadAudit` and
// `loadFlags`.
//
// THE ACTOR IS ALREADY PSEUDONYMIZED BY THE SERVER, OR NULL FOR A SYSTEM
// ACTION. This module renders it verbatim — it never re-derives an identity
// and never invents a pseudonym for an actor that was never a person (the
// scheduler's auto-waive has no admin in the loop at all).

import { apiFetch } from "@/lib/sync/apiFetch.ts";

export interface FlagAuditEntry {
  flagKey: string;
  action: string;
  /** The server's own HMAC pseudonym for the acting admin, or `null` when
   *  the action was taken by the unattended scheduler (auto-waive). */
  actor: string | null;
  reason: string | null;
  acknowledgesRetentionRisk: boolean;
  acknowledgesNoDarkPattern: boolean;
  typedFlagName: string | null;
  /** Epoch milliseconds — the wire's own `at`, never re-derived. */
  at: number;
}

export type FlagAuditLoad =
  | { state: "loading" }
  | { state: "ready"; entries: FlagAuditEntry[]; limit: number }
  /** The API could not be reached or did not answer with a usable body.
   *  Never painted as "no ramp activity" — that would look like a real,
   *  observed reading, when in fact nothing was read at all. */
  | { state: "unavailable"; reason: string };

function isFlagAuditEntry(v: unknown): v is FlagAuditEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.flagKey === "string" &&
    typeof e.action === "string" &&
    (typeof e.actor === "string" || e.actor === null) &&
    (typeof e.reason === "string" || e.reason === null) &&
    typeof e.acknowledgesRetentionRisk === "boolean" &&
    typeof e.acknowledgesNoDarkPattern === "boolean" &&
    (typeof e.typedFlagName === "string" || e.typedFlagName === null) &&
    typeof e.at === "number"
  );
}

/**
 * Fetch the most recent flag ramp-audit entries, optionally narrowed to one
 * flag key. Never throws — every failure (network, non-2xx, unparseable
 * body, a body missing the contract's fields) becomes `unavailable` with a
 * reason an operator can act on, exactly as `loadAudit`/`loadFlags`.
 */
export async function loadFlagAudit(flagKey?: string): Promise<FlagAuditLoad> {
  const qs = flagKey ? `?flag=${encodeURIComponent(flagKey)}` : "";

  let response: Response;
  try {
    response = await apiFetch(`/api/admin/flags/audit${qs}`);
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
    !("entries" in body) ||
    !Array.isArray((body as Record<string, unknown>).entries) ||
    !((body as Record<string, unknown>).entries as unknown[]).every(isFlagAuditEntry) ||
    typeof (body as Record<string, unknown>).limit !== "number"
  ) {
    return { state: "unavailable", reason: "the API's answer carried no ramp-audit list" };
  }

  const { entries, limit } = body as { entries: FlagAuditEntry[]; limit: number };
  return { state: "ready", entries, limit };
}
