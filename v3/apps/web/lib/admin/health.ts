"use client";

// THE SYSTEM HEALTH CLIENT (build-plan step 24, M8) — the missing frontend
// half of `Admin\SystemHealthController`.
//
// The backend (`GET /api/admin/health`, `POST
// /api/admin/health/rebuild-atom-cache`) has existed since the admin console
// landed, fully tested (`tests/Feature/Admin/SystemHealthTest.php`, 7 tests
// incl. edge case #167's unknown-vs-zero distinction and #168's rebuild
// mutex) — but nothing under `apps/web` ever called it. `grep -rln
// "admin/health" apps/web` (excluding this module and its own tests) returns
// nothing. The mechanism the checks section of LAUNCH-CHECKLIST reports on
// had no face an operator could actually look at.
//
// EGRESS: through `apiFetch` only (check-boundaries.mjs clause 6), same
// reasoning `lib/workbench/verifications.ts#loadFrontier` already states.
//
// FAILURE IS A STATE, NOT AN EXCEPTION — mirroring `loadFrontier` exactly,
// which itself mirrors #167: "a failed probe renders `unknown`, never 0."
// This module adds nothing on top of what the controller already promises;
// it decodes the SAME response shape the PHPUnit suite pins.

import { apiFetch } from "@/lib/sync/apiFetch.ts";

export type HealthStatus = "ok" | "divergent" | "unknown";

export interface HealthCheck {
  metric: string;
  status: HealthStatus;
  value: number | null;
  detail: string | null;
}

export interface HealthReport {
  checks: HealthCheck[];
  rebuildRunning: boolean;
}

export type HealthLoad =
  | { state: "loading" }
  | { state: "ready"; report: HealthReport }
  /** The API could not be reached or did not answer with a usable body.
   *  Never painted as "all checks unknown" — that would look like a real,
   *  observed reading, when in fact nothing was read at all. */
  | { state: "unavailable"; reason: string };

function isHealthCheck(v: unknown): v is HealthCheck {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.metric === "string" &&
    (c.status === "ok" || c.status === "divergent" || c.status === "unknown") &&
    (typeof c.value === "number" || c.value === null) &&
    (typeof c.detail === "string" || c.detail === null)
  );
}

/**
 * Fetch the admin health report. Never throws — every failure (network,
 * non-2xx, unparseable body, a body missing the contract's fields) becomes
 * `unavailable` with a reason an operator can act on, exactly as
 * `loadFrontier` does for the verification frontier.
 */
export async function loadHealth(): Promise<HealthLoad> {
  let response: Response;
  try {
    response = await apiFetch("/api/admin/health");
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
    !("checks" in body) ||
    !Array.isArray((body as Record<string, unknown>).checks) ||
    !((body as Record<string, unknown>).checks as unknown[]).every(isHealthCheck) ||
    typeof (body as Record<string, unknown>).rebuildRunning !== "boolean"
  ) {
    return { state: "unavailable", reason: "the API's answer carried no health report" };
  }

  const b = body as { checks: HealthCheck[]; rebuildRunning: boolean };

  return { state: "ready", report: { checks: b.checks, rebuildRunning: b.rebuildRunning } };
}

export interface RebuildOutcome {
  ok: boolean;
  /** True only for #168's "already running, queued rather than run" case. */
  queued: boolean;
  message: string;
  usersProcessed?: number;
  atomsWritten?: number;
}

/**
 * Trigger the atom-cache rebuild. Never throws — a network failure becomes a
 * non-`ok` outcome with a human-readable message, same discipline as
 * `loadHealth`.
 */
export async function rebuildAtomCache(): Promise<RebuildOutcome> {
  let response: Response;
  try {
    response = await apiFetch("/api/admin/health/rebuild-atom-cache", { method: "POST" });
  } catch (err) {
    return {
      ok: false,
      queued: false,
      message: err instanceof Error ? `request failed: ${err.message}` : "request failed",
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, queued: false, message: "the API's answer was not JSON" };
  }

  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

  // #168: a 202 means another rebuild holds the mutex — this request queued
  // rather than ran. Reported distinctly, never conflated with a failure.
  if (response.status === 202 && b.queued === true) {
    return {
      ok: false,
      queued: true,
      message: typeof b.reason === "string" ? b.reason : "a rebuild is already running",
    };
  }

  if (!response.ok || b.started !== true) {
    return {
      ok: false,
      queued: false,
      message: typeof b.reason === "string" ? b.reason : `the API answered ${response.status}`,
    };
  }

  return {
    ok: true,
    queued: false,
    message: "rebuild complete",
    usersProcessed: typeof b.usersProcessed === "number" ? b.usersProcessed : undefined,
    atomsWritten: typeof b.atomsWritten === "number" ? b.atomsWritten : undefined,
  };
}
