"use client";

// THE CONTENT-FREEZE CLIENT (build-plan step 28, M9) — the missing frontend
// half of `Admin\ContentFreezeController`.
//
// The backend (`GET /api/admin/content-freeze`) has existed since M9's freeze
// gate landed, fully tested (`tests/Feature/ContentFreeze/ContentFreezeTest.php`)
// — but the controller's own docblock claim, "the workbench shows them
// together," was never true: nothing under `apps/web` ever called it. This
// module is that missing caller, mirroring `lib/admin/health.ts#loadHealth`'s
// three-state discipline exactly.
//
// EGRESS: through `apiFetch` only (check-boundaries.mjs clause 6).
//
// FAILURE IS A STATE, NOT AN EXCEPTION — same reasoning as `loadHealth` and
// `loadFrontier`: a screen that cannot tell "0 criteria met" from "we could
// not ask" would license booking a scholar against a corpus nobody actually
// checked. This module adds nothing on top of what the controller already
// promises; it decodes the SAME response shape the PHPUnit suite pins.

import { apiFetch } from "@/lib/sync/apiFetch.ts";

export interface FreezeCriterion {
  name: string;
  met: boolean;
  evidence: string[];
}

export interface FreezeReport {
  surahs: number[];
  allMet: boolean;
  bookable: boolean;
  criteria: FreezeCriterion[];
  note: string;
}

export type FreezeLoad =
  | { state: "loading" }
  | { state: "ready"; report: FreezeReport }
  /** The API could not be reached or did not answer with a usable body.
   *  Never painted as "no criteria met" — that would look like a real,
   *  observed reading, when in fact nothing was read at all. */
  | { state: "unavailable"; reason: string };

function isFreezeCriterion(v: unknown): v is FreezeCriterion {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.name === "string" &&
    typeof c.met === "boolean" &&
    Array.isArray(c.evidence) &&
    c.evidence.every((e) => typeof e === "string")
  );
}

/**
 * Fetch the content-freeze report. Never throws — every failure (network,
 * non-2xx, unparseable body, a body missing the contract's fields) becomes
 * `unavailable` with a reason an operator can act on, exactly as `loadHealth`.
 *
 * @param surahs Optional launch-surah subset. Omitted, the controller's own
 *               default (BUILD-PLAN's launch set) applies.
 */
export async function loadContentFreeze(surahs?: number[]): Promise<FreezeLoad> {
  const query = surahs && surahs.length > 0 ? `?surahs=${surahs.join(",")}` : "";

  let response: Response;
  try {
    response = await apiFetch(`/api/admin/content-freeze${query}`);
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
    !("criteria" in body) ||
    !Array.isArray((body as Record<string, unknown>).criteria) ||
    !((body as Record<string, unknown>).criteria as unknown[]).every(isFreezeCriterion) ||
    typeof (body as Record<string, unknown>).allMet !== "boolean" ||
    typeof (body as Record<string, unknown>).bookable !== "boolean" ||
    !Array.isArray((body as Record<string, unknown>).surahs)
  ) {
    return { state: "unavailable", reason: "the API's answer carried no freeze report" };
  }

  const b = body as {
    surahs: number[];
    allMet: boolean;
    bookable: boolean;
    criteria: FreezeCriterion[];
    note: unknown;
  };

  return {
    state: "ready",
    report: {
      surahs: b.surahs,
      allMet: b.allMet,
      bookable: b.bookable,
      criteria: b.criteria,
      note: typeof b.note === "string" ? b.note : "",
    },
  };
}
