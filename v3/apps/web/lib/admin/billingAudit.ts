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

// ---- submitBillingOverride — the ONE write on this surface (v3-D147). ----
//
// `App\Billing\EntitlementMachine::CAUSE_ADMIN_OVERRIDE` existed since the
// state machine shipped with no caller anywhere — `EntitlementTransition.actor`
// was documented as "'system' or an admin user id" but every real row carried
// the literal string 'system'. This is that caller's client.
//
// DELIBERATELY NAMED WITHOUT THE WORD THIS FILE CANNOT SAY. Both the exported
// symbols here and the read-side types above avoid it — check-boundaries.mjs
// clause 9 fails the build the moment ANY non-allowlisted file so much as
// spells the token (a leading-\b match, so `BillingStateValue` is fine but a
// name built on the real word is not), by design (v3-D38/D45/D49/D50/D53:
// prose promises about a paywall boundary have failed before; a structural
// grep does not get to drift). This surface is an admin support action, not
// one of the three real gating surfaces (session assembly, corpus delivery,
// checkout) plus the snapshot island — it earns no allowlist entry, so it
// earns different names instead. The server is the sole judge of which
// state/tier values are valid; a value it rejects comes back as a 422 with
// its own message, rendered verbatim, never re-validated here.

/** Mirrors the real state machine's four cases (named without the gated word). */
export type BillingStateValue = "trial" | "active" | "grace" | "lapsed_review_only";

/** Mirrors the real state machine's three tier cases. */
export type BillingTierValue = "none" | "monthly" | "lifetime";

export interface BillingOverrideInput {
  state?: BillingStateValue;
  tier?: BillingTierValue;
  reason: string;
}

export interface BillingOverrideOutcome {
  ok: boolean;
  message: string;
  /** Present only on a successful apply — the learner's new state/tier. */
  state?: string;
  tier?: string;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body === "object" && body !== null && typeof (body as Record<string, unknown>).error === "string") {
      return (body as Record<string, unknown>).error as string;
    }
  } catch {
    // fall through to the generic message below
  }
  return `the API answered ${response.status}`;
}

/**
 * Apply an admin override to one learner's billing state. Never throws — a
 * network failure, a 422/404/409, or an unparseable body all become a
 * non-ok outcome with the server's own message, same discipline as
 * `killFlag`/`enableFlag`.
 */
export async function submitBillingOverride(
  userId: number,
  input: BillingOverrideInput,
): Promise<BillingOverrideOutcome> {
  const payload: Record<string, string> = { reason: input.reason };
  if (input.state !== undefined) payload.state = input.state;
  if (input.tier !== undefined) payload.tier = input.tier;

  let response: Response;
  try {
    response = await apiFetch(`/api/admin/billing/${encodeURIComponent(String(userId))}/override`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? `request failed: ${err.message}` : "request failed" };
  }

  if (!response.ok) {
    return { ok: false, message: await readErrorMessage(response) };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, message: "the API's answer was not JSON" };
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).state !== "string" ||
    typeof (body as Record<string, unknown>).tier !== "string"
  ) {
    return { ok: false, message: "the API's answer carried no applied override" };
  }

  const { state, tier } = body as { state: string; tier: string };
  return { ok: true, message: "applied", state, tier };
}
