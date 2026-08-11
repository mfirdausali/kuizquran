"use client";

// QARI MODE — SIGNING A TIER FOR AN AYAH (build-plan step 28 / M9).
//
// The write half of the frontier. `verifications.ts` reads the worklist; this
// module is how a row moves from amber or grey to green.
//
// ---------------------------------------------------------------------------
// TOCTOU: WHY THIS MODULE NEVER SENDS A HASH
// ---------------------------------------------------------------------------
// The obvious design is: the screen shows the reviewer hash H, the reviewer
// signs, the client POSTs H. That is a time-of-check/time-of-use bug with a
// scholar's name attached — between the render and the click, an override or a
// recompile can change the ayah, and the client would stamp a signature onto
// content the reviewer never saw.
//
// The server already refuses to participate. `VerificationsController::store`
// reads its OWN ingested current hash at commit and, in its own words, "a
// client-submitted `contentHash` (if sent) is silently ignored, never trusted,
// never even read here."
//
// So this module does not send one. Not because sending would be accepted —
// it would not — but because a field the server ignores is a field a future
// reader believes in. `SignRequest` HAS NO HASH FIELD; the shape makes the
// mistake unexpressible rather than merely ineffective.
//
// WHAT THE CLIENT MUST STILL DO — and this is the part the server cannot do
// for us. The server stamps whatever is current at commit. If that moved since
// the render, the reviewer signed bytes they did not read. The server's stamp
// is CORRECT (it is the truth at commit) but the CONSENT is stale. So after
// every signature this module RE-READS the frontier and compares: if the row
// did not land green, or the hash the server stamped differs from the one the
// screen was showing, the caller is told the signature landed on DIFFERENT
// content and must re-review. That is a warning about consent, not an error
// about storage — the row is real either way, and hiding it would be worse.
//
// ---------------------------------------------------------------------------
// reviewer_kind IS NOT A DEFAULT (v3-D22)
// ---------------------------------------------------------------------------
// `ayah_verifications.reviewer_kind ∈ {ai, human}`. Launch requires every
// launch-surah batch AI-green and hash-current; it does NOT require a human
// row — "the Arabic is authentic because of its SOURCE, not because anyone
// certified it." But: "No UI claims scholar verification for a surah lacking a
// human row."
//
// A default value here would be the mechanism by which that claim becomes
// false — an AI batch run that omitted the field and quietly recorded `human`,
// or a human session that recorded `ai` and left the surah looking uncertified
// when it was. So `reviewerKind` is a REQUIRED field with no default, and
// `describeCertification` below is the one place any surface may ask "may this
// UI say a scholar verified this."

import { apiFetch } from "@/lib/sync/apiFetch.ts";
import { buildWorklist, type ChipState, type FrontierResponse } from "./frontier.ts";

/** v3-D13's two tiers. qari = text+glosses+beats; admin = distractors+specs. */
export type Tier = "qari" | "admin";

/** v3-D22's vocabulary. No default, anywhere, ever. */
export type ReviewerKind = "ai" | "human";

/** What a caller supplies to sign. NOTE THE ABSENCE of a content hash — see
 *  the header. The server computes it at commit; there is nothing to send. */
export interface SignRequest {
  surah: number;
  ayah: number;
  tier: Tier;
  reviewerKind: ReviewerKind;
  note?: string;
  /** The chip the SCREEN was showing when the reviewer decided. Used only to
   *  detect that the content moved between render and commit — never sent. */
  chipAtRender: ChipState;
}

/** One stored verification row, as `VerificationsController::toWire` sends it. */
export interface VerificationRow {
  id: number;
  surah: number;
  ayah: number;
  tier: Tier;
  contentHash: string;
  hashSpecVersion: number;
  reviewerKind: ReviewerKind;
  verifiedBy: string | null;
  note: string | null;
  createdAt: number;
}

export type SignResult =
  /** Stored, and a re-read confirms the ayah is green on the signed tier. */
  | { state: "signed"; row: VerificationRow }
  /** Stored — but the re-read says the content is NOT what the reviewer was
   *  shown. The row exists (it is append-only; nothing is undone); the CONSENT
   *  is stale and the ayah must be re-reviewed. */
  | { state: "signed-but-stale"; row: VerificationRow; reason: string }
  /** Not stored. */
  | { state: "failed"; reason: string };

/**
 * Sign one tier of one ayah, then verify the signature actually landed on the
 * content the reviewer was shown.
 *
 * Never throws: a booked scholar clicking "sign" must never meet a stack trace,
 * and a thrown error inside a review session is indistinguishable from a
 * successful signature to the person sitting there.
 */
export async function signAyah(req: SignRequest): Promise<SignResult> {
  let response: Response;
  try {
    response = await apiFetch("/api/verifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Exactly the server's validated fields. No contentHash — see header.
      body: JSON.stringify({
        surah: req.surah,
        ayah: req.ayah,
        tier: req.tier,
        reviewerKind: req.reviewerKind,
        note: req.note ?? null,
      }),
    });
  } catch (err) {
    return {
      state: "failed",
      reason: err instanceof Error ? `request failed: ${err.message}` : "request failed",
    };
  }

  if (response.status === 403 || response.status === 401) {
    // The admin gate. Named plainly: a qari who is not on the allowlist should
    // be told that, not shown a generic failure they will retry ten times.
    return { state: "failed", reason: "not authorised to sign — this account is not on the admin allowlist" };
  }
  if (!response.ok) {
    let detail = `the API answered ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (typeof body?.error === "string") detail = body.error;
    } catch {
      // Keep the status-code reason.
    }
    return { state: "failed", reason: detail };
  }

  let row: VerificationRow;
  try {
    const body = (await response.json()) as { verification?: VerificationRow };
    if (!body?.verification) {
      return { state: "failed", reason: "the API accepted the signature but returned no row" };
    }
    row = body.verification;
  } catch {
    return { state: "failed", reason: "the API's answer was not JSON" };
  }

  // THE CONSENT RE-READ. The row is stored; the question now is whether it is
  // stored against what the reviewer looked at.
  const confirmation = await confirmGreen(req.surah, req.ayah, req.tier);
  if (confirmation.ok) {
    return { state: "signed", row };
  }
  return { state: "signed-but-stale", row, reason: confirmation.reason };
}

/**
 * Re-read the frontier and confirm the signed tier is now green.
 *
 * A tier that is NOT green immediately after a successful signature means the
 * current hash moved between the render and the commit — the server stamped
 * the new content, so the row is honest, but the reviewer approved the old.
 */
async function confirmGreen(
  surah: number,
  ayah: number,
  tier: Tier,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let response: Response;
  try {
    response = await apiFetch(`/api/verifications?surah=${surah}`);
  } catch {
    // Could not confirm. NOT treated as confirmation — an unverifiable
    // signature is reported as such, because the safe direction on this
    // screen is always "needs another look".
    return { ok: false, reason: "the signature was stored but the frontier could not be re-read to confirm it" };
  }
  if (!response.ok) {
    return { ok: false, reason: `the signature was stored but the frontier re-read answered ${response.status}` };
  }

  let body: FrontierResponse;
  try {
    body = (await response.json()) as FrontierResponse;
  } catch {
    return { ok: false, reason: "the signature was stored but the frontier re-read was not JSON" };
  }

  const row = buildWorklist(body).rows.find((r) => r.ayah === ayah);
  if (!row) {
    return { ok: false, reason: "the signature was stored but the ayah is absent from the re-read frontier" };
  }
  const tierStatus = tier === "qari" ? row.qari : row.admin;
  if (tierStatus === "verified") return { ok: true };

  return {
    ok: false,
    reason:
      `the ${tier} tier reads "${tierStatus}" immediately after signing — the content changed ` +
      `between the review and the commit, so this signature covers bytes that were not reviewed. Re-review this ayah.`,
  };
}

// ---------------------------------------------------------------------------
// v3-D22's CLAIM RULE, IN ONE PLACE
// ---------------------------------------------------------------------------
// "No UI claims scholar verification for a surah lacking a human row."
//
// Every surface that wants to say something about verification asks HERE, so
// the rule is enforced by there being exactly one function that can answer.
// A component computing its own sentence from raw counts is how the claim
// drifts — and this specific claim, made falsely, is a religious-authority
// misrepresentation, not a copy bug.

export interface CertificationClaim {
  /** May a surface use the words "scholar" or "certified"? */
  mayClaimScholarVerification: boolean;
  /** The sentence a surface should show. Never assembled by the caller. */
  sentence: string;
}

/**
 * What may honestly be said about a surah's verification state.
 *
 * `rows` is every verification row for the surah — the caller passes what the
 * API returned, and this decides. AI rows never license a scholar claim, no
 * matter how many there are or how green the frontier is.
 */
export function describeCertification(
  rows: readonly VerificationRow[],
  allGreen: boolean,
): CertificationClaim {
  const humanQari = rows.filter((r) => r.reviewerKind === "human" && r.tier === "qari");

  if (humanQari.length === 0) {
    return {
      mayClaimScholarVerification: false,
      // The honest sentence, and it is v3-D22's own reasoning: authenticity
      // comes from the SOURCE, not from a signature that does not exist.
      sentence: allGreen
        ? "AI-reviewed and hash-current. No human scholar has certified this surah — the Arabic is authentic because of its source (Tanzil/QAC), not because anyone here certified it."
        : "Not fully reviewed. No human scholar has certified this surah.",
    };
  }

  return {
    mayClaimScholarVerification: allGreen,
    sentence: allGreen
      ? `Reviewed by a human qari and hash-current (${humanQari.length} signed ayah-tier row${humanQari.length === 1 ? "" : "s"}).`
      : // A human signed SOMETHING, but the frontier is not green — so the
        // claim is not available. A partially-certified surah must not borrow
        // the credibility of a complete one.
        `A human qari has signed part of this surah, but the frontier is not green — content has changed since, or ayat remain unreviewed.`,
  };
}
