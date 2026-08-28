"use client";

// THE RAW WEBHOOK JOURNAL VIEWER CLIENT — the missing frontend half of the new
// `Admin\BillingEventsController` (v3-D148).
//
// `billing_events` has been written on EVERY inbound Stripe delivery since
// build-plan step 23 (`WebhookHandler::ingest()`'s own header: "INSERT FIRST,
// THEN PROCESS... a crash mid-handler leaves a replayable row rather than a
// silently-lost event") and read by nothing under `apps/web` until now — the
// same "built + populated + zero read surface" shape v3-D129/D130/D141/D142
// fixed for `admin_audit`/`flag_ramp_audit`/`entitlement_transitions`/
// `purge_ledger`. `lib/admin/billingAudit.ts` reads the DERIVED state-change
// log (`entitlement_transitions`) — a different table. A webhook that arrives,
// fails to parse, hits an unhandled type, or throws mid-processing leaves
// NOTHING in that derived log; only this raw journal shows it happened.
//
// EGRESS: through `apiFetch` only (check-boundaries.mjs clause 6).
//
// FAILURE IS A STATE, NOT AN EXCEPTION — same discipline as `loadBillingAudit`.
//
// THE SUBJECT ARRIVES ALREADY PSEUDONYMIZED BY THE SERVER (or `null` — a
// delivery that never resolves to a learner, e.g. `ignored_unhandled`, has
// none). This module renders it verbatim, never re-derives or re-formats it.
//
// THE RAW PAYLOAD IS NEVER PART OF THIS CONTRACT — the server deliberately
// never returns it (it can carry a customer's email or billing address); this
// type has no `payload` field to accidentally forward.

import { apiFetch } from "@/lib/sync/apiFetch.ts";

export interface BillingEventEntry {
  provider: string;
  providerEventId: string;
  type: string;
  /** applied | ignored_duplicate | ignored_stale | ignored_unhandled | error — the
   *  server's own closed set, rendered verbatim, never re-derived here. */
  outcome: string | null;
  /** Set only when `outcome === "error"`. */
  error: string | null;
  /** The server's own HMAC pseudonym, or `null` for a delivery that never
   *  resolved to a learner. */
  subjectPseudonym: string | null;
  /** Epoch milliseconds, Stripe's own `created` — `null` if the delivery
   *  carried none. */
  providerCreatedAt: number | null;
  /** Epoch milliseconds — when this server first saw the delivery. */
  receivedAt: number;
  /** Epoch milliseconds — `null` if processing never completed (should not
   *  happen in practice; `ingest()` always updates this on both success and
   *  the error path, but a mid-write crash between insert and update is the
   *  one gap the journal exists to make visible rather than hide). */
  processedAt: number | null;
}

export type BillingEventsLoad =
  | { state: "loading" }
  | { state: "ready"; entries: BillingEventEntry[]; limit: number }
  /** The API could not be reached or did not answer with a usable body.
   *  Never painted as "no deliveries" — that would look like a real, observed
   *  reading, when in fact nothing was read at all. */
  | { state: "unavailable"; reason: string };

function isBillingEventEntry(v: unknown): v is BillingEventEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.provider === "string" &&
    typeof e.providerEventId === "string" &&
    typeof e.type === "string" &&
    (typeof e.outcome === "string" || e.outcome === null) &&
    (typeof e.error === "string" || e.error === null) &&
    (typeof e.subjectPseudonym === "string" || e.subjectPseudonym === null) &&
    (typeof e.providerCreatedAt === "number" || e.providerCreatedAt === null) &&
    typeof e.receivedAt === "number" &&
    (typeof e.processedAt === "number" || e.processedAt === null)
  );
}

/**
 * Fetch the most recent raw webhook journal entries, optionally narrowed to
 * one learner's raw user id (from a support ticket, same convention every
 * other admin audit viewer uses) and/or one `outcome` value (an operator
 * triaging failures narrows straight to `"error"`). Never throws — every
 * failure becomes `unavailable` with a reason an operator can act on.
 */
export async function loadBillingEvents(opts?: {
  userId?: number;
  outcome?: string;
}): Promise<BillingEventsLoad> {
  const params = new URLSearchParams();
  if (opts?.userId !== undefined) params.set("userId", String(opts.userId));
  if (opts?.outcome !== undefined && opts.outcome !== "") params.set("outcome", opts.outcome);
  const qs = params.size > 0 ? `?${params.toString()}` : "";

  let response: Response;
  try {
    response = await apiFetch(`/api/admin/billing/events${qs}`);
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
    !((body as Record<string, unknown>).entries as unknown[]).every(isBillingEventEntry) ||
    typeof (body as Record<string, unknown>).limit !== "number"
  ) {
    return { state: "unavailable", reason: "the API's answer carried no billing-events list" };
  }

  const { entries, limit } = body as { entries: BillingEventEntry[]; limit: number };
  return { state: "ready", entries, limit };
}
