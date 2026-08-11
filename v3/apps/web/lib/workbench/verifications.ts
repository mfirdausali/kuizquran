"use client";

// THE FRONTIER CLIENT — the REAL step-15 verification API, not a stub.
//
// `GET /api/verifications?surah=N` is deliberately a PUBLIC read in
// `routes/api.php`, with the reason written at the route: "the admin console's
// not-yet-built worklist view and any future public transparency page both need
// this un-gated." This module is that not-yet-built view's data half.
//
// EGRESS: through `apiFetch` only. check-boundaries.mjs clause 6 makes a second
// un-wrapped `fetch("/api/...")` a build failure, and the reason is DEFECTS.md#B8
// — a raw call carries a dead token, 401s forever, and never clears anything.
// A read that does not strictly need auth still goes through the wrapper,
// because the wrapper is the only thing that keeps "everything goes through the
// wrapper" true.
//
// FAILURE IS A STATE, NOT AN EXCEPTION. A frontier that cannot be fetched must
// render as "unknown", never as an empty worklist that reads like "nothing to
// do" and never as zeros that read like "nothing is verified." This mirrors
// BUILD-PLAN's own rule for the admin console (#167: "a failed probe renders
// `unknown`, never 0 — the console must distinguish healthy from blind"), and
// it is the same three-state discipline the learner-facing islands already use
// (skeleton / true-empty / broken).

import { apiFetch } from "@/lib/sync/apiFetch.ts";
import { buildWorklist, type FrontierResponse, type FrontierWorklist } from "./frontier.ts";

export type FrontierLoad =
  | { state: "loading" }
  | { state: "ready"; worklist: FrontierWorklist }
  /** The API could not be reached or did not answer with a usable body. The
   *  worklist is NOT included — a broken load has no rows to show, and
   *  supplying an empty one would be indistinguishable from a real empty. */
  | { state: "unavailable"; reason: string };

/**
 * Fetch one surah's frontier and reduce it to a worklist.
 *
 * Never throws. Every failure — network, non-2xx, unparseable body, a body
 * whose shape is not the contract — becomes `unavailable` with a reason a human
 * can act on.
 */
export async function loadFrontier(surah: number): Promise<FrontierLoad> {
  let response: Response;
  try {
    response = await apiFetch(`/api/verifications?surah=${surah}`);
  } catch (err) {
    return {
      state: "unavailable",
      reason: err instanceof Error ? `request failed: ${err.message}` : "request failed",
    };
  }

  if (!response.ok) {
    return { state: "unavailable", reason: `the API answered ${response.status}` };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { state: "unavailable", reason: "the API's answer was not JSON" };
  }

  // The contract is one field. If it is absent the response is not this
  // endpoint's, and treating it as an empty frontier would paint "no ayat"
  // over what is actually a wiring bug.
  if (typeof body !== "object" || body === null || !("frontier" in body)) {
    return { state: "unavailable", reason: "the API's answer carried no frontier" };
  }

  return { state: "ready", worklist: buildWorklist(body as FrontierResponse) };
}
