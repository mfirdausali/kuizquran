"use client";

// THE REVEAL-IDENTITY CLIENT (build-plan step 24, M8) — the missing frontend
// half of `Admin\RevealController`.
//
// WIREFRAME §16: "Email and name sit behind a Reveal identity action requiring
// a typed reason, audit-logged, auto-re-masking after 15 minutes." The
// backend (`POST /api/admin/users/{userId}/reveal`, `GET
// /api/admin/reveal/{token}`) has existed, fully tested
// (`tests/Feature/Admin/AdminPrivacyTest.php`) — including the M10
// security-review fix scoping a token to the admin who minted it — since
// build-plan step 24 landed, but nothing under `apps/web` ever called it.
// Same "built + tested + zero production callers" shape as v3-D100/D124/
// D125/D126's findings; named explicitly in v3-D125/D127 as the next
// zero-caller admin surface, deferred each time for "its own careful UI
// pass" because it is the privacy-sensitive one.
//
// EGRESS: through `apiFetch` only (check-boundaries.mjs clause 6).
//
// THE SERVER DECIDES EVERYTHING THIS MODULE REPORTS. `AdminRevealController`
// enforces the reason-code closed set, the >=10-char reason text, the
// PII-in-free-text warning-then-acknowledge flow, and the server-side TTL
// (edge case #147 — a client-supplied expiry is a suggestion an attacker
// writes). This module carries those fields to the server and reports back
// exactly what it decided; it re-implements none of those rules.
//
// FAILURE IS A STATE, NEVER AN EXCEPTION — same discipline as
// `lib/admin/flags.ts`/`lib/admin/health.ts`.

import { apiFetch } from "@/lib/sync/apiFetch.ts";

/** Mirrors `AdminAudit::REASON_CODES` — a closed set enforced server-side.
 *  Keeping this list here only shapes the picker; the server rejects any
 *  value outside it regardless of what this array contains. */
export const REVEAL_REASON_CODES = [
  "support_ticket",
  "billing_dispute",
  "abuse_report",
  "legal_request",
  "data_subject_request",
] as const;

export type RevealReasonCode = (typeof REVEAL_REASON_CODES)[number];

export interface RevealInput {
  reasonCode: string;
  reasonText: string;
  acknowledgePiiWarning?: boolean;
}

export type RevealResult =
  | {
      state: "revealed";
      pseudonym: string;
      email: string;
      name: string | null;
      revealToken: string;
      expiresAt: number;
    }
  /** Edge case #148: a defined, audited response — never a 404 that would
   *  leak "this account is anonymous" while skipping the audit row. */
  | { state: "anonymous"; pseudonym: string }
  | { state: "not-found"; pseudonym: string }
  /** Edge case #149: the server detected a PII-shaped string in the typed
   *  reason and refused to write it until acknowledged. */
  | { state: "pii-warning"; detected: string[]; hint: string }
  | { state: "rejected"; reason: string }
  | { state: "failed"; reason: string };

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function requestFailed(err: unknown): { state: "failed"; reason: string } {
  return {
    state: "failed",
    reason: err instanceof Error ? `request failed: ${err.message}` : "request failed",
  };
}

/** Never throws. Every failure — network, validation, an unrecognised shape
 *  — becomes a named state a caller can render without a try/catch. */
export async function revealIdentity(userId: number, input: RevealInput): Promise<RevealResult> {
  let response: Response;
  try {
    response = await apiFetch(`/api/admin/users/${userId}/reveal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason_code: input.reasonCode,
        reason_text: input.reasonText,
        acknowledge_pii_warning: input.acknowledgePiiWarning ?? false,
      }),
    });
  } catch (err) {
    return requestFailed(err);
  }

  const body = await readJson(response);

  if (response.status === 422) {
    const b = (body ?? {}) as { error?: unknown; detected?: unknown; hint?: unknown };
    if (Array.isArray(b.detected)) {
      return {
        state: "pii-warning",
        detected: b.detected.filter((d): d is string => typeof d === "string"),
        hint: typeof b.hint === "string" ? b.hint : "",
      };
    }
    return {
      state: "rejected",
      reason: typeof b.error === "string" ? b.error : "the reveal request was rejected",
    };
  }

  if (response.status === 404) {
    const b = (body ?? {}) as { pseudonym?: unknown };
    return { state: "not-found", pseudonym: typeof b.pseudonym === "string" ? b.pseudonym : "" };
  }

  if (!response.ok) {
    return { state: "failed", reason: `the API answered ${response.status}` };
  }

  const b = body as { pseudonym?: unknown; identity?: unknown; revealToken?: unknown; expiresAt?: unknown };
  if (typeof b.pseudonym !== "string") {
    return { state: "failed", reason: "the API's answer carried no pseudonym" };
  }
  if (b.identity === null) {
    return { state: "anonymous", pseudonym: b.pseudonym };
  }
  const identity = b.identity as { email?: unknown; name?: unknown } | undefined;
  if (
    !identity ||
    typeof identity.email !== "string" ||
    typeof b.revealToken !== "string" ||
    typeof b.expiresAt !== "number"
  ) {
    return { state: "failed", reason: "the API's answer carried no usable identity" };
  }
  return {
    state: "revealed",
    pseudonym: b.pseudonym,
    email: identity.email,
    name: typeof identity.name === "string" ? identity.name : null,
    revealToken: b.revealToken,
    expiresAt: b.expiresAt,
  };
}

export type CheckResult =
  | { state: "valid"; expiresAt: number }
  /** Deliberately IDENTICAL for expired, unknown, and belongs-to-another-admin
   *  — the server's own refusal is one shape (`AdminRevealController::check`'s
   *  own docblock), and distinguishing them here would reinvent the oracle it
   *  refuses to be. */
  | { state: "invalid" }
  | { state: "failed"; reason: string };

/** Re-checks a reveal token — whether it is still live, per the server's own
 *  clock and ownership rule. Never throws. */
export async function checkRevealToken(token: string): Promise<CheckResult> {
  let response: Response;
  try {
    response = await apiFetch(`/api/admin/reveal/${encodeURIComponent(token)}`);
  } catch (err) {
    const f = requestFailed(err);
    return { state: "failed", reason: f.reason };
  }

  if (response.status === 403) return { state: "invalid" };
  if (!response.ok) return { state: "failed", reason: `the API answered ${response.status}` };

  const body = await readJson(response);
  const b = (body ?? {}) as { valid?: unknown; expiresAt?: unknown };
  if (b.valid === true && typeof b.expiresAt === "number") {
    return { state: "valid", expiresAt: b.expiresAt };
  }
  return { state: "invalid" };
}
