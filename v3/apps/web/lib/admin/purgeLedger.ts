"use client";

// THE PDPA PURGE LEDGER VIEWER CLIENT — the missing frontend half of
// `Admin\PurgeLedgerController`.
//
// `purge_ledger` has been written every night by `pdpa:purge-due` since PDPA
// delete/purge shipped (v3-D79/D80) — every elapsed deletion request that
// crosses the grace period leaves a permanent row here — and read by nothing
// under `apps/web`. The learner-facing `/settings` panels (v3-D80) let a
// learner REQUEST and RESTORE their own deletion; nothing anywhere lets an
// operator confirm a purge actually happened, the same "built + populated +
// zero read surface" shape v3-D129/D130/D141 fixed for `admin_audit`/
// `flag_ramp_audit`/`entitlement_transitions`, this module's direct template.
//
// EGRESS: through `apiFetch` only (check-boundaries.mjs clause 6).
//
// FAILURE IS A STATE, NOT AN EXCEPTION — same discipline as `loadAudit`,
// `loadFlagAudit` and `loadBillingAudit`.
//
// THE SUBJECT ARRIVES ALREADY PSEUDONYMIZED BY THE SERVER. This module
// renders it verbatim — it never re-derives or re-formats an identity.

import { apiFetch } from "@/lib/sync/apiFetch.ts";

export interface PurgeLedgerEntry {
  /** The server's own HMAC pseudonym for the (now-deleted) learner. */
  subjectPseudonym: string;
  /** Epoch milliseconds — the wire's own `purgedAtMs`, never re-derived. */
  purgedAtMs: number;
  /** Always `"pdpa_delete"` today — the only writer this table has. */
  reason: string;
}

export type PurgeLedgerLoad =
  | { state: "loading" }
  | { state: "ready"; entries: PurgeLedgerEntry[]; limit: number }
  /** The API could not be reached or did not answer with a usable body.
   *  Never painted as "nothing purged" — that would look like a real,
   *  observed reading, when in fact nothing was read at all. */
  | { state: "unavailable"; reason: string };

function isPurgeLedgerEntry(v: unknown): v is PurgeLedgerEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.subjectPseudonym === "string" &&
    typeof e.purgedAtMs === "number" &&
    typeof e.reason === "string"
  );
}

/**
 * Fetch the most recent PDPA purge-ledger entries, optionally narrowed to
 * one raw user id — the same convention `lib/admin/reveal.ts` and
 * `lib/admin/billingAudit.ts` established (an operator has the raw id from a
 * support ticket, never a pseudonym, which is one-way by design and cannot
 * be reversed into a user id to filter by). Never throws — every failure
 * (network, non-2xx, unparseable body, a body missing the contract's fields)
 * becomes `unavailable` with a reason an operator can act on.
 */
export async function loadPurgeLedger(userId?: number): Promise<PurgeLedgerLoad> {
  const qs = userId !== undefined ? `?userId=${encodeURIComponent(String(userId))}` : "";

  let response: Response;
  try {
    response = await apiFetch(`/api/admin/purge-ledger${qs}`);
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
    !((body as Record<string, unknown>).entries as unknown[]).every(isPurgeLedgerEntry) ||
    typeof (body as Record<string, unknown>).limit !== "number"
  ) {
    return { state: "unavailable", reason: "the API's answer carried no purge-ledger list" };
  }

  const { entries, limit } = body as { entries: PurgeLedgerEntry[]; limit: number };
  return { state: "ready", entries, limit };
}
