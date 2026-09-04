// THE GATE-A FRONTIER, AS A WORKLIST (WIREFRAME §22b, build-plan step 25).
//
// §22b's ayah navigator carries "verification chips — green verified, amber
// stale when the content hash no longer matches, grey unverified — turning the
// GATE-A frontier into a worklist."
//
// The word doing the work there is WORKLIST. A frontier rendered as decoration
// is a progress bar; a frontier rendered as a worklist answers "what do I sign
// next, and why that one." So this module's output is ORDERED BY WHAT NEEDS
// ATTENTION, and the ordering is a decision — which is why it lives here and
// not in a component (check-boundaries.mjs clause 5: engine decisions never
// appear in JSX, and by the same principle neither does this one).
//
// ---------------------------------------------------------------------------
// THE STATUS COMES FROM THE SERVER. THIS FILE NEVER COMPUTES ONE.
// ---------------------------------------------------------------------------
// DEFECTS.md#B3 was "ayah_verifications has no content hash", and its
// consequence was stated bluntly in §22: "the GATE-A verified frontier metric
// is provably lying today." Step 15 closed it server-side —
// `VerificationsController::index` compares each row's `content_hash` against
// the CURRENT tier hash in `corpus_ayah_hashes` and returns
// verified/stale/unverified per tier.
//
// Recomputing that here from raw rows would resurrect B3 in a second place: the
// client would need its own copy of "what is the current hash", it would drift,
// and the drift would be invisible because both numbers would look plausible.
// So this module TRANSPORTS a server verdict and never derives one. The wire
// type below is the contract; anything it does not recognise degrades to
// `unverified`, which is the safe direction — an unknown status must never
// paint green.
//
// ---------------------------------------------------------------------------
// TWO TIERS, ONE CHIP — AND THE WEAKER TIER WINS
// ---------------------------------------------------------------------------
// The API reports per-tier status (`qari` and `admin` — WIREFRAME's own tiering:
// qari covers text+glosses+beats, admin covers distractors+specs). The navigator
// shows ONE chip per ayah, so the two must be reduced, and the direction of that
// reduction is a safety decision:
//
//     green  iff BOTH tiers are verified
//     amber  iff neither tier is unverified and at least one is stale
//     grey   otherwise
//
// The weakest tier wins. An ayah whose text is signed but whose distractors
// have drifted is NOT ready to serve, and painting it green because one tier
// is happy is exactly the class of lie B3 was about.
//
// Note what "stale" means and why it outranks "unverified" in the worklist but
// not in the chip: a stale ayah was ALREADY REVIEWED and the content moved
// underneath the signature. That is a regression in a reviewed artifact, and it
// is more urgent than an ayah nobody has looked at yet — but it is not more
// TRUSTWORTHY, so the chip is still not green.

/** v3-D13's two tiers. qari = text+glosses+beats; admin = distractors+specs.
 *  Lives here, not in sign.ts, because it is part of the WIRE contract this
 *  module owns — `sign.ts` imports it, never the other way round. */
export type Tier = "qari" | "admin";

/** v3-D22's vocabulary. No default, anywhere, ever — see sign.ts's header
 *  for why a defaulted `reviewerKind` is the mechanism by which a false
 *  "scholar verified this" claim would become possible. */
export type ReviewerKind = "ai" | "human";

/** One stored verification row, as `VerificationsController::toWire` sends
 *  it — the SAME shape the `frontier` field above is reduced from, carried
 *  raw so a caller (`sign.ts#describeCertification`) can ask a question the
 *  reduced chip cannot answer: was any of this signed by a human. */
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

/** Exactly the statuses `VerificationsController::index` emits per tier.
 *  A value outside this set is treated as unknown → unverified. */
export type TierStatus = "verified" | "stale" | "unverified";

/** The chip an ayah row paints. Named for the state, not the colour, so the
 *  view owns presentation and this module owns the judgement. */
export type ChipState = "verified" | "stale" | "unverified";

/** The `frontier` map as the API sends it: ayah number → per-tier status.
 *  `ingestedAt` (v3-D176) is `corpus_ayah_hashes.ingested_at` for THIS ayah's
 *  row — when its current hash was last written, by a manual ingest or an
 *  override's synchronous recompute (v3-D174) alike. */
export interface FrontierWire {
  [ayah: string]: { qari?: string; admin?: string; ingestedAt?: number };
}

export interface FrontierResponse {
  frontier?: FrontierWire;
  /** The raw rows behind the reduced `frontier` map above — present on the
   *  real controller response since step 15, but carried through here only
   *  as of v3-D152 (it was fetched and discarded by every prior reader). */
  verifications?: VerificationRow[];
}

export interface FrontierRow {
  ayah: number;
  qari: TierStatus;
  admin: TierStatus;
  /** The single chip, reduced weakest-tier-wins. */
  chip: ChipState;
  /** One sentence naming what to do about this row. Never jargon-free to the
   *  point of vagueness — an admin needs to know WHICH tier moved. */
  note: string;
  /** v3-D176: when THIS ayah's current hash was last ingested (ms epoch),
   *  straight off `corpus_ayah_hashes.ingested_at` — the one fact that lets
   *  an admin tell "just recomputed" from "stale from before the corpus last
   *  changed". `null` for a missing or malformed value, never fabricated. */
  hashIngestedAt: number | null;
}

export interface FrontierWorklist {
  rows: FrontierRow[];
  /** Counts for the pane header. Sum to `rows.length` by construction. */
  verified: number;
  stale: number;
  unverified: number;
  /** True only when every ayah in the response is green on both tiers —
   *  M9's exit criterion ("frontier 100% green hash-current"), stated as a
   *  single fact so no view has to re-derive it from three counts.
   *
   *  FALSE for an EMPTY response. An empty frontier means the API returned
   *  nothing for this surah — no hashes ingested, or the request failed. A
   *  vacuous "100% green" on zero rows is the most dangerous possible reading
   *  of this screen, so emptiness is never success. */
  allGreen: boolean;
}

function toTierStatus(raw: string | undefined): TierStatus {
  // Fails to the SAFE side: anything unrecognised is unverified, never green.
  return raw === "verified" || raw === "stale" ? raw : "unverified";
}

/** Weakest tier wins. See the header for why this direction is not arbitrary. */
export function reduceChip(qari: TierStatus, admin: TierStatus): ChipState {
  if (qari === "verified" && admin === "verified") return "verified";
  if (qari === "unverified" || admin === "unverified") return "unverified";
  return "stale";
}

function noteFor(qari: TierStatus, admin: TierStatus): string {
  const stale: string[] = [];
  const missing: string[] = [];
  if (qari === "stale") stale.push("qari");
  if (admin === "stale") stale.push("admin");
  if (qari === "unverified") missing.push("qari");
  if (admin === "unverified") missing.push("admin");

  if (stale.length === 0 && missing.length === 0) {
    return "Signed and hash-current on both tiers.";
  }
  const parts: string[] = [];
  if (stale.length > 0) {
    parts.push(
      `content changed since the ${stale.join(" and ")} signature — re-sign needed`,
    );
  }
  if (missing.length > 0) {
    parts.push(`never reviewed at the ${missing.join(" and ")} tier`);
  }
  return `${parts.join("; ")}.`;
}

/** Worklist order: stale first (a reviewed artifact regressed — the most
 *  urgent thing on this screen), then unverified, then verified; ayah number
 *  ascending within each band so the list is stable and scannable. */
const CHIP_PRIORITY: Record<ChipState, number> = {
  stale: 0,
  unverified: 1,
  verified: 2,
};

/**
 * Turn the step-15 API's frontier into an ordered worklist.
 *
 * Total: a malformed, partial or absent response yields an EMPTY worklist with
 * `allGreen: false`, never a throw into a render and never a fabricated row.
 */
export function buildWorklist(response: FrontierResponse | null): FrontierWorklist {
  const frontier = response?.frontier ?? {};

  const rows: FrontierRow[] = Object.entries(frontier)
    .map(([key, tiers]) => {
      const ayah = Number(key);
      if (!Number.isInteger(ayah) || ayah < 1) return null;
      const qari = toTierStatus(tiers?.qari);
      const admin = toTierStatus(tiers?.admin);
      const hashIngestedAt = typeof tiers?.ingestedAt === "number" ? tiers.ingestedAt : null;
      return {
        ayah,
        qari,
        admin,
        chip: reduceChip(qari, admin),
        note: noteFor(qari, admin),
        hashIngestedAt,
      };
    })
    .filter((r): r is FrontierRow => r !== null)
    .sort((a, b) => CHIP_PRIORITY[a.chip] - CHIP_PRIORITY[b.chip] || a.ayah - b.ayah);

  const verified = rows.filter((r) => r.chip === "verified").length;
  const stale = rows.filter((r) => r.chip === "stale").length;
  const unverified = rows.filter((r) => r.chip === "unverified").length;

  return {
    rows,
    verified,
    stale,
    unverified,
    // Emptiness is never success — see the field's own docblock.
    allGreen: rows.length > 0 && verified === rows.length,
  };
}
