"use client";

// THE BILLING AUDIT VIEWER CLIENT — BUILD-PLAN M7's own named deliverable,
// never built: "admin billing surface." The missing frontend half of
// `Admin\AdminBillingController`.
//
// `entitlement_transitions` has been written by every `EntitlementMachine
// ::apply()` call (webhook, trial start, reconcile, admin override) since the
// entitlement state machine shipped, and read by nothing under `apps/web` —
// the same "built + populated + zero read surface" shape v3-D129/D130 fixed
// for `admin_audit`/`flag_ramp_audit`, this module's direct template. An
// operator asking "why did this learner's tier flip to lapsed_review_only,
// and when" had a database console and nothing else.
//
// EGRESS: through `apiFetch` only (check-boundaries.mjs clause 6).
//
// FAILURE IS A STATE, NOT AN EXCEPTION — same discipline as `loadAudit` and
// `loadFlagAudit`.
//
// BOTH IDENTITIES ARRIVE ALREADY PSEUDONYMIZED BY THE SERVER. This module
// renders them verbatim — it never re-derives or re-formats an identity, the
// same rule `lib/admin/reveal.ts`'s consumers already follow. `fromState`/
// `toState` are rendered as the server's own wire strings, deliberately typed
// `string | null` here rather than importing `lib/entitlement/`'s
// `EntitlementState` union — this is a read-only admin display, not an
// enforcement point, and check-boundaries.mjs clause 9's entitlement-read
// allowlist is reserved for the three real gating surfaces plus the
// entitlement island itself, not every screen that happens to display a
// billing-state string.

import { apiFetch } from "@/lib/sync/apiFetch.ts";

export interface BillingAuditEntry {
  /** The server's own HMAC pseudonym for the learner whose entitlement changed. */
  subjectPseudonym: string;
  /** `null` only for a learner's very first transition, which has no predecessor. */
  fromState: string | null;
  toState: string;
  cause: string;
  /** Set only for webhook-caused transitions. */
  providerEventId: string | null;
  /** "system" verbatim, or the server's own HMAC pseudonym for an admin actor. */
  actor: string;
  reason: string | null;
  /** Epoch milliseconds — the wire's own `at`, never re-derived. */
  at: number;
}

export type BillingAuditLoad =
  | { state: "loading" }
  | { state: "ready"; entries: BillingAuditEntry[]; limit: number }
  /** The API could not be reached or did not answer with a usable body.
   *  Never painted as "no billing activity" — that would look like a real,
   *  observed reading, when in fact nothing was read at all. */
  | { state: "unavailable"; reason: string };

function isBillingAuditEntry(v: unknown): v is BillingAuditEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.subjectPseudonym === "string" &&
    (typeof e.fromState === "string" || e.fromState === null) &&
    typeof e.toState === "string" &&
    typeof e.cause === "string" &&
    (typeof e.providerEventId === "string" || e.providerEventId === null) &&
    typeof e.actor === "string" &&
    (typeof e.reason === "string" || e.reason === null) &&
    typeof e.at === "number"
  );
}

/**
 * Fetch the most recent billing (entitlement transition) audit entries,
 * optionally narrowed to one learner's raw user id — the same convention
 * `lib/admin/reveal.ts` established (an operator has the raw id from a
 * support ticket, never a pseudonym, which is one-way by design and cannot
 * be reversed into a user id to filter by). Never throws — every failure
 * (network, non-2xx, unparseable body, a body missing the contract's fields)
 * becomes `unavailable` with a reason an operator can act on.
 */
export async function loadBillingAudit(userId?: number): Promise<BillingAuditLoad> {
  const qs = userId !== undefined ? `?userId=${encodeURIComponent(String(userId))}` : "";

  let response: Response;
  try {
    response = await apiFetch(`/api/admin/billing${qs}`);
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
    !((body as Record<string, unknown>).entries as unknown[]).every(isBillingAuditEntry) ||
    typeof (body as Record<string, unknown>).limit !== "number"
  ) {
    return { state: "unavailable", reason: "the API's answer carried no billing-audit list" };
  }

  const { entries, limit } = body as { entries: BillingAuditEntry[]; limit: number };
  return { state: "ready", entries, limit };
}
