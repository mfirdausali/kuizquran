"use client";

// PDPA SELF-SERVICE CLIENT (build-plan step 23 / M7, LAUNCH-CHECKLIST.md gate
// 19). `AccountController` (v3-D79) has existed on the server since the
// previous run; this module is the first thing in `apps/web` that calls it.
//
// All four routes are scoped to `$request->user()->id` server-side — nothing
// here ever sends or reads a user id. There is no "delete this learner"
// button anywhere in the admin console (v3-D16): this is the only path.
//
// EGRESS: through `apiFetch` only (check-boundaries.mjs clause 6 /
// DEFECTS.md#B8) so a dead token clears and re-mints on this screen exactly
// like every other authenticated call, rather than 401ing forever here.
//
// FAILURE IS A STATE, NEVER AN EXCEPTION — the same discipline
// lib/workbench/verifications.ts and lib/workbench/sign.ts already use. A
// destructive-action screen must not throw into a render.

import { apiFetch } from "@/lib/sync/apiFetch.ts";

/** One event row as `AccountController::export()` emits it — every wire
 *  column except the internal `id`/`user_id` (excluded server-side by
 *  EXCLUSION, not an allowlist, so a new column shows up here automatically
 *  rather than silently dropping out of a PDPA export). */
export type ExportedEvent = Record<string, unknown>;

export interface AccountExport {
  exportedAt: string;
  account: {
    id: number;
    email: string | null;
    name: string | null;
    isAnonymous: boolean;
    createdAt: string | null;
    emailVerifiedAt: string | null;
  };
  events: ExportedEvent[];
}

export type ExportResult =
  | { state: "ready"; data: AccountExport }
  | { state: "failed"; reason: string };

function requestFailed(err: unknown): { state: "failed"; reason: string } {
  return {
    state: "failed",
    reason: err instanceof Error ? `request failed: ${err.message}` : "request failed",
  };
}

/** PDPA "right to access". Never throws. */
export async function fetchAccountExport(): Promise<ExportResult> {
  let response: Response;
  try {
    response = await apiFetch("/api/account/export");
  } catch (err) {
    return requestFailed(err);
  }
  if (!response.ok) return { state: "failed", reason: `the API answered ${response.status}` };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { state: "failed", reason: "the API's answer was not JSON" };
  }
  if (typeof body !== "object" || body === null || !("events" in body) || !("account" in body)) {
    return { state: "failed", reason: "the API's answer carried no export payload" };
  }
  return { state: "ready", data: body as AccountExport };
}

export type DeletionStatus =
  | { pending: false }
  | { pending: true; requestedAt: number; purgeAt: number };

export type DeletionStatusLoad =
  | { state: "ready"; status: DeletionStatus }
  /** The status could not be read. NOT the same as "not pending" — a screen
   *  that painted "not pending" here could let a learner re-request a
   *  deletion that is already scheduled and get a spurious 409, or worse,
   *  believe a real pending deletion does not exist. */
  | { state: "unavailable"; reason: string };

/** Whether a deletion is currently scheduled for this account. Never throws. */
export async function fetchDeletionStatus(): Promise<DeletionStatusLoad> {
  let response: Response;
  try {
    response = await apiFetch("/api/account/deletion");
  } catch (err) {
    const f = requestFailed(err);
    return { state: "unavailable", reason: f.reason };
  }
  if (!response.ok) return { state: "unavailable", reason: `the API answered ${response.status}` };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { state: "unavailable", reason: "the API's answer was not JSON" };
  }
  if (typeof body !== "object" || body === null || !("pending" in body)) {
    return { state: "unavailable", reason: "the API's answer carried no deletion status" };
  }
  return { state: "ready", status: body as DeletionStatus };
}

export type RequestDeletionResult =
  | { state: "scheduled"; restoreToken: string; requestedAt: number; purgeAt: number }
  /** A deletion is already pending — the token already handed out is the only
   *  valid cancel path (`AccountController::requestDeletion`'s own 409). */
  | { state: "already-pending" }
  | { state: "forbidden"; reason: string }
  | { state: "failed"; reason: string };

/** Schedules a purge. Never deletes anything itself — see the module header. */
export async function requestAccountDeletion(): Promise<RequestDeletionResult> {
  let response: Response;
  try {
    response = await apiFetch("/api/account/deletion", { method: "POST" });
  } catch (err) {
    return requestFailed(err);
  }

  if (response.status === 409) return { state: "already-pending" };
  if (response.status === 403) {
    let reason = "this account cannot self-delete";
    try {
      const body = (await response.json()) as { error?: string };
      if (typeof body?.error === "string") reason = body.error;
    } catch {
      // fall through with the generic reason
    }
    return { state: "forbidden", reason };
  }
  if (!response.ok) return { state: "failed", reason: `the API answered ${response.status}` };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { state: "failed", reason: "the API's answer was not JSON" };
  }
  const b = body as { restoreToken?: unknown; requestedAt?: unknown; purgeAt?: unknown };
  if (
    typeof b.restoreToken !== "string" ||
    b.restoreToken === "" ||
    typeof b.requestedAt !== "number" ||
    typeof b.purgeAt !== "number"
  ) {
    return { state: "failed", reason: "the API's answer carried no restore token" };
  }
  return {
    state: "scheduled",
    restoreToken: b.restoreToken,
    requestedAt: b.requestedAt,
    purgeAt: b.purgeAt,
  };
}

export type RestoreDeletionResult =
  | { state: "restored" }
  /** The token did not match a pending deletion for THIS account — wrong
   *  token, already restored, or already purged. The server's own 404 does
   *  not distinguish these (`AccountController::restoreDeletion`), and
   *  neither does this client: a token oracle is exactly the wrong thing to
   *  build on top of a security-scoped lookup. */
  | { state: "not-found" }
  | { state: "failed"; reason: string };

/** Cancels a pending deletion. Never throws. */
export async function restoreAccountDeletion(token: string): Promise<RestoreDeletionResult> {
  let response: Response;
  try {
    response = await apiFetch("/api/account/deletion/restore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch (err) {
    return requestFailed(err);
  }

  if (response.status === 404) return { state: "not-found" };
  if (!response.ok) return { state: "failed", reason: `the API answered ${response.status}` };
  return { state: "restored" };
}
