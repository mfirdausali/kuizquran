"use client";

// QARI MODE — THE SIGNING PANE (§22b, build-plan step 28 / M9).
//
// The frontier navigator answers "what do I sign next". This pane is where it
// gets signed. It decides NOTHING: the tier, the reviewer kind and the note are
// the reviewer's inputs; every verdict about what happened comes back from
// `lib/workbench/sign.ts` as data (check-boundaries.mjs clause 5).
//
// ---------------------------------------------------------------------------
// WHY reviewer_kind IS A DELIBERATE CHOICE AND NOT A HIDDEN FIELD
// ---------------------------------------------------------------------------
// v3-D22 splits rows into `ai` and `human`, and the consequence is a claim
// rule: no UI may say a scholar verified a surah that has no human row. If this
// pane defaulted the field, an AI batch could quietly record `human` rows and
// manufacture that claim — a religious-authority misrepresentation produced by
// a form default. So the control is explicit, unset by default, and the button
// is disabled until a person chooses.
//
// ---------------------------------------------------------------------------
// WHY "SIGNED BUT STALE" IS A LOUD, DISTINCT STATE
// ---------------------------------------------------------------------------
// The server stamps the hash it reads at commit (TOCTOU-safe). If content moved
// between the render and the click, the ROW IS HONEST but the CONSENT IS NOT —
// the reviewer approved bytes they did not see. Collapsing that into "signed"
// would hide exactly the failure the TOCTOU design exists to surface, and
// collapsing it into "failed" would be a lie in the other direction (the row
// exists; it is append-only; nothing was undone). It is its own state, in its
// own words, with the re-review instruction attached.
//
// ---------------------------------------------------------------------------
// WHY THE QARI TIER IS DISABLED, NOT MERELY REJECTED (v3-D131)
// ---------------------------------------------------------------------------
// `VerificationsController::store` has required `AdminRole::QARI` for
// `tier: qari` since v3-D92 — server-enforced, correctly. But this pane
// offered "Qari tier" to every admin regardless of role, so an operator or
// moderator admin could fill in the whole form and learn only from a 403
// that they were never eligible. That is the exact affordance-the-server-
// will-refuse shape this codebase treats as a defect elsewhere (a locked
// library row is not a link; a disabled control explains why rather than
// pretending to work). `useAdminRoles()` reads the identity `AdminGate`
// already fetched, over context — no second request, and nothing here
// changes what the SERVER accepts.

import { useState } from "react";
import type { ChipState } from "@/lib/workbench/frontier.ts";
import {
  signAyah,
  type ReviewerKind,
  type SignResult,
  type Tier,
} from "@/lib/workbench/sign.ts";
import { useAdminRoles } from "@/lib/admin/identity-context";

const TIERS: ReadonlyArray<{ value: Tier; label: string; covers: string }> = [
  // v3-D13's tiering, named on the screen so a reviewer knows what their
  // signature covers. A qari signing "the ayah" without knowing distractors
  // are excluded is a consent problem, not a labelling nicety.
  { value: "qari", label: "Qari tier", covers: "text, glosses and scene beats" },
  { value: "admin", label: "Admin tier", covers: "distractors and specs" },
];

const REVIEWER_KINDS: ReadonlyArray<{ value: ReviewerKind; label: string; note: string }> = [
  { value: "human", label: "Human", note: "a person reviewed this ayah" },
  { value: "ai", label: "AI", note: "machine-reviewed; licenses no scholar claim" },
];

export interface QariModeProps {
  surah: number;
  ayah: number | null;
  /** The chip the navigator is currently showing for this ayah. */
  chip: ChipState | null;
  /** Called after a signature so the parent can re-read the worklist. */
  onSigned: () => void;
}

export function QariMode({ surah, ayah, chip, onSigned }: QariModeProps) {
  // Deny by default (`useAdminRoles()`'s own contract) — an admin with no
  // resolvable identity gets the same posture as one with no roles at all.
  const roles = useAdminRoles();
  const canSignQariTier = roles.includes("qari");
  // The initial selection reflects what THIS caller can actually sign —
  // defaulting to a tier they cannot submit would just move the surprise
  // from "the option is disabled" to "the button always fails."
  const [tier, setTier] = useState<Tier>(canSignQariTier ? "qari" : "admin");
  // NO DEFAULT. See the header — a default here is how a false scholar claim
  // gets manufactured.
  const [reviewerKind, setReviewerKind] = useState<ReviewerKind | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SignResult | null>(null);

  if (ayah === null || chip === null) {
    return (
      <section className="card" aria-labelledby="qari-h">
        <div className="card-header">
          <h2 id="qari-h" className="wb-h">
            QARI MODE
          </h2>
        </div>
        <p className="caption">Select an ayah in the frontier to sign it.</p>
      </section>
    );
  }

  const canSign = reviewerKind !== null && !busy && (tier !== "qari" || canSignQariTier);

  async function onSubmit() {
    if (reviewerKind === null || ayah === null || chip === null) return;
    setBusy(true);
    setResult(null);
    // The signature carries the chip the SCREEN was showing, so the module can
    // report a render/commit divergence. It is never sent to the server.
    const next = await signAyah({
      surah,
      ayah,
      tier,
      reviewerKind,
      note: note.trim() === "" ? undefined : note.trim(),
      chipAtRender: chip,
    });
    setResult(next);
    setBusy(false);
    if (next.state !== "failed") {
      setNote("");
      onSigned();
    }
  }

  return (
    <section className="card" aria-labelledby="qari-h">
      <div className="card-header">
        <h2 id="qari-h" className="wb-h">
          QARI MODE
        </h2>
        <span className="ltr-island">
          {surah}:{ayah}
        </span>
      </div>

      <fieldset className="wb-field">
        <legend className="caption">Tier being signed</legend>
        <div className="stack stack--tight">
          {TIERS.map((t) => {
            const disabled = t.value === "qari" && !canSignQariTier;
            return (
              <label key={t.value} className="wb-lane-opt">
                <input
                  type="radio"
                  name="qari-tier"
                  value={t.value}
                  checked={tier === t.value}
                  disabled={disabled}
                  onChange={() => setTier(t.value)}
                />
                <span>
                  {t.label} <span className="caption">— {t.covers}</span>
                  {disabled && (
                    <span className="caption"> — requires the qari role; ask an operator to grant it</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="wb-field">
        <legend className="caption">Reviewer (required — no default)</legend>
        <div className="stack stack--tight">
          {REVIEWER_KINDS.map((k) => (
            <label key={k.value} className="wb-lane-opt">
              <input
                type="radio"
                name="qari-reviewer-kind"
                value={k.value}
                checked={reviewerKind === k.value}
                onChange={() => setReviewerKind(k.value)}
              />
              <span>
                {k.label} <span className="caption">— {k.note}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="wb-field">
        <span className="caption">Note (optional)</span>
        {/* A TEXTAREA, never a field that could carry Arabic into content.
            This is a REVIEW note stored on the verification row; it is not a
            gloss, not a correction, and no serving path reads it. Corrections
            go through the override path, which is hashed. */}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="What was checked, or why this was rejected"
        />
      </label>

      <button type="button" className="btn" disabled={!canSign} onClick={() => void onSubmit()}>
        {busy ? "Signing…" : `Sign ${tier} tier for ayah ${ayah}`}
      </button>

      {reviewerKind === null && (
        <p className="caption">Choose a reviewer kind — an AI review and a human review are different records (v3-D22).</p>
      )}

      {/* The hash is never shown as an input and never typed. The server reads
          its own ingested current hash at commit; there is nothing here for a
          reviewer to confirm or a client to forge. */}
      <p className="caption">
        The server recomputes the current content hash at commit — this screen
        never sends one.
      </p>

      {result !== null && <SignOutcome result={result} />}
    </section>
  );
}

/** The three outcomes, each in its own words. `role="status"` so a reviewer
 *  using a screen reader is told what happened without moving focus. */
function SignOutcome({ result }: { result: SignResult }) {
  if (result.state === "signed") {
    return (
      <p role="status" className="voice">
        Signed. Ayah {result.row.ayah} is green on the {result.row.tier} tier,
        recorded as a {result.row.reviewerKind} review against hash spec{" "}
        <span className="ltr-island">v{result.row.hashSpecVersion}</span>.
      </p>
    );
  }
  if (result.state === "signed-but-stale") {
    return (
      <p role="alert" className="voice">
        The signature was stored, but it does not cover what you reviewed.{" "}
        {result.reason}
      </p>
    );
  }
  return (
    <p role="alert" className="voice">
      Not signed. {result.reason}
    </p>
  );
}
