"use client";

// THE 7-CONSECUTIVE-GREEN-NIGHTS WINDOW CLIENT — the missing frontend half
// of `Admin\NightlyWindowController`.
//
// BUILD-PLAN M10's launch gate ("both determinism checks green nightly...
// confirmed P1 resets the window") has been computable since
// `NightlyWindowLedger` shipped, but reachable only via
// `php artisan nightly:window` on a machine with SSH access — no admin
// screen has ever read it. Same "built + populated + zero read surface"
// shape as `billingAudit.ts`/`flagAudit.ts`/`purgeLedger.ts`, this module's
// direct templates.
//
// EGRESS: through `apiFetch` only (check-boundaries.mjs clause 6).
//
// FAILURE IS A STATE, NOT AN EXCEPTION — same discipline as every other
// admin loader in this directory.
//
// THIS MODULE NEVER COMPUTES THE STREAK. `NightlyWindowLedger::status()`
// owns that arithmetic (edge case #169); this is a verbatim pass-through of
// the server's own answer, same as `loadContentFreeze`.

import { apiFetch } from "@/lib/sync/apiFetch.ts";

export interface NightlyWindowNight {
  night: string;
  green: boolean;
  severities: Record<string, string>;
  missing: string[];
}

/** v3-D178: one `nightly_check_runs.report` finding from a `fold_determinism_check`
 *  P1, pseudonymized server-side (`Admin\NightlyWindowController::foldFindings`)
 *  — the per-atom evidence behind a confirmed P1, never the raw learner id. */
export interface NightlyWindowFoldFinding {
  type: "fold";
  subjectPseudonym: string;
  key: string;
  kind: string;
  cachedVersion: string | null;
}

/** v3-D179: one `SelectionCheckReport.divergences` entry from a
 *  `selection_determinism_check` P1 (`Admin\NightlyWindowController
 *  ::selectionFindings`). The check replays a committed fixture log, never
 *  production events, so — unlike a fold finding — there is no learner id
 *  to pseudonymize here; `seed`/`traceKey` are what a human re-runs to see
 *  the divergence again. `baseline`/`replayed` are the server's own
 *  `SelectionResult | null` for that trace, passed through untransformed —
 *  never re-validated field by field here, since this is diagnostic
 *  evidence, not a value this module's own logic branches on. */
export interface NightlyWindowSelectionFinding {
  type: "selection";
  seed: number;
  traceKey: string;
  baseline: unknown;
  replayed: unknown;
}

export type NightlyWindowFinding = NightlyWindowFoldFinding | NightlyWindowSelectionFinding;

export interface NightlyWindowStatus {
  streak: number;
  required: number;
  satisfied: boolean;
  windowStartedAt: string | null;
  windowReason: string | null;
  nights: NightlyWindowNight[];
  lastP1: { night: string; check: string } | null;
  /** v3-D178: null when there is no confirmed P1 in the window's history;
   *  otherwise the findings for that ONE run. Never fabricated — a missing
   *  or malformed value degrades the whole list to null, same discipline
   *  as every other parsed-from-the-wire field in this module. */
  lastP1Findings: readonly NightlyWindowFinding[] | null;
  blockedBy: string | null;
}

export type NightlyWindowLoad =
  | { state: "loading" }
  | { state: "ready"; status: NightlyWindowStatus }
  /** The API could not be reached or did not answer with a usable body.
   *  Never painted as "0 of 7" — that would look like an observed reading
   *  of a real streak, when in fact nothing was read at all. */
  | { state: "unavailable"; reason: string };

function isNight(v: unknown): v is NightlyWindowNight {
  if (typeof v !== "object" || v === null) return false;
  const n = v as Record<string, unknown>;
  return (
    typeof n.night === "string" &&
    typeof n.green === "boolean" &&
    typeof n.severities === "object" &&
    n.severities !== null &&
    Array.isArray(n.missing)
  );
}

function isFoldFinding(f: Record<string, unknown>): boolean {
  return (
    f.type === "fold" &&
    typeof f.subjectPseudonym === "string" &&
    typeof f.key === "string" &&
    typeof f.kind === "string" &&
    (typeof f.cachedVersion === "string" || f.cachedVersion === null)
  );
}

function isSelectionFinding(f: Record<string, unknown>): boolean {
  return (
    f.type === "selection" &&
    typeof f.seed === "number" &&
    typeof f.traceKey === "string" &&
    "baseline" in f &&
    "replayed" in f
  );
}

function isFinding(v: unknown): v is NightlyWindowFinding {
  if (typeof v !== "object" || v === null) return false;
  const f = v as Record<string, unknown>;
  return isFoldFinding(f) || isSelectionFinding(f);
}

/** `lastP1Findings` is checked separately (`parseLastP1Findings`), never
 *  here — a malformed value there degrades to null rather than rejecting
 *  the whole payload, same discipline as every other individually-degraded
 *  field this module reads. */
function isStatus(v: unknown): v is Omit<NightlyWindowStatus, "lastP1Findings"> {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.streak === "number" &&
    typeof s.required === "number" &&
    typeof s.satisfied === "boolean" &&
    (typeof s.windowStartedAt === "string" || s.windowStartedAt === null) &&
    (typeof s.windowReason === "string" || s.windowReason === null) &&
    Array.isArray(s.nights) &&
    s.nights.every(isNight) &&
    (s.lastP1 === null ||
      (typeof s.lastP1 === "object" &&
        s.lastP1 !== null &&
        typeof (s.lastP1 as Record<string, unknown>).night === "string" &&
        typeof (s.lastP1 as Record<string, unknown>).check === "string")) &&
    (typeof s.blockedBy === "string" || s.blockedBy === null)
  );
}

/**
 * Fetch the 7-consecutive-green-nights window status. Never throws — every
 * failure (network, non-2xx, unparseable body, a body missing the
 * contract's fields) becomes `unavailable` with a reason an operator can
 * act on.
 */
export async function loadNightlyWindow(): Promise<NightlyWindowLoad> {
  let response: Response;
  try {
    response = await apiFetch("/api/admin/nightly-window");
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

  if (!isStatus(body)) {
    return { state: "unavailable", reason: "the API's answer carried no window status" };
  }

  return { state: "ready", status: { ...body, lastP1Findings: parseLastP1Findings(body) } };
}

/** A missing or malformed `lastP1Findings` degrades to `null` — the same
 *  "no live P1 findings" shape a genuinely-null field reports — rather than
 *  a partial or fabricated list. */
function parseLastP1Findings(body: unknown): readonly NightlyWindowFinding[] | null {
  const raw = (body as { lastP1Findings?: unknown } | null)?.lastP1Findings;
  return Array.isArray(raw) && raw.every(isFinding) ? raw : null;
}
