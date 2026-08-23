"use client";

// THE AUDIT VIEWER CLIENT (build-plan step 24, M8) — the missing frontend
// half of `Admin\AdminAuditController`.
//
// `admin_audit` has been written by four call sites since the console
// shipped (reveal, bulk CSV export, atom-cache rebuild, the Stripe
// connection probe) and read by none under `apps/web` — the same
// "built + populated + zero read surface" shape as v3-D100/D124/D125's
// controller findings, but on the trail BUILD-PLAN M8 itself names as a
// deliverable: "nav homes for flags/reports/templates/audit viewer."
//
// EGRESS: through `apiFetch` only (check-boundaries.mjs clause 6).
//
// FAILURE IS A STATE, NOT AN EXCEPTION — same discipline as `loadHealth`
// and `loadFlags`.
//
// THE ACTOR IS ALREADY PSEUDONYMIZED BY THE SERVER. This module renders it
// verbatim — it never re-derives or re-formats an identity, the same rule
// `lib/admin/reveal.ts` follows for a revealed identity.

import { apiFetch } from "@/lib/sync/apiFetch.ts";

export interface AuditEntry {
  /** The server's own HMAC pseudonym for the acting admin (`u_…`). */
  actor: string;
  action: string;
  subjectPseudonym: string | null;
  reasonCode: string;
  reasonText: string;
  /** Epoch milliseconds — the wire's own `at`, never re-derived. */
  at: number;
}

export type AuditLoad =
  | { state: "loading" }
  | { state: "ready"; entries: AuditEntry[]; limit: number }
  /** The API could not be reached or did not answer with a usable body.
   *  Never painted as "no audit activity" — that would look like a real,
   *  observed reading, when in fact nothing was read at all. */
  | { state: "unavailable"; reason: string };

function isAuditEntry(v: unknown): v is AuditEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.actor === "string" &&
    typeof e.action === "string" &&
    (typeof e.subjectPseudonym === "string" || e.subjectPseudonym === null) &&
    typeof e.reasonCode === "string" &&
    typeof e.reasonText === "string" &&
    typeof e.at === "number"
  );
}

/**
 * Fetch the most recent audit entries, optionally narrowed to one subject
 * pseudonym. Never throws — every failure (network, non-2xx, unparseable
 * body, a body missing the contract's fields) becomes `unavailable` with a
 * reason an operator can act on, exactly as `loadFlags`.
 */
export async function loadAudit(subjectPseudonym?: string): Promise<AuditLoad> {
  const qs = subjectPseudonym ? `?subject=${encodeURIComponent(subjectPseudonym)}` : "";

  let response: Response;
  try {
    response = await apiFetch(`/api/admin/audit${qs}`);
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
    !((body as Record<string, unknown>).entries as unknown[]).every(isAuditEntry) ||
    typeof (body as Record<string, unknown>).limit !== "number"
  ) {
    return { state: "unavailable", reason: "the API's answer carried no audit list" };
  }

  const { entries, limit } = body as { entries: AuditEntry[]; limit: number };
  return { state: "ready", entries, limit };
}
