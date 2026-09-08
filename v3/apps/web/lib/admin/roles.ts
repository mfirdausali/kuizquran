"use client";

// THE ADMIN ROLES VIEWER CLIENT — the missing frontend half of
// `Admin\AdminRolesController`.
//
// `admin_roles` has been written by `admin:grant-role` since v3-D92 with no
// admin-facing reader anywhere. `GET /api/admin/whoami` only ever answers
// "what does THE CALLING admin hold" (consumed by `identity-context.tsx` to
// disable the qari-signature radio for a non-qari admin, v3-D131) — nothing
// under `apps/web` ever asked "who holds what". Same "built + populated +
// zero read surface" shape v3-D129/D130/D141/D142 fixed for
// `admin_audit`/`flag_ramp_audit`/`entitlement_transitions`/`purge_ledger`,
// this module's direct template (`lib/admin/purgeLedger.ts`).
//
// EGRESS: through `apiFetch` only (check-boundaries.mjs clause 6).
//
// FAILURE IS A STATE, NOT AN EXCEPTION — same discipline as `loadAudit`,
// `loadFlagAudit` and `loadPurgeLedger`.
//
// THE SUBJECT ARRIVES ALREADY PSEUDONYMIZED BY THE SERVER. This module
// renders it verbatim — it never re-derives or re-formats an identity.

import { apiFetch } from "@/lib/sync/apiFetch.ts";

export type AdminRoleValue = "operator" | "qari" | "moderator";

export interface AdminRoleEntry {
  /** The server's own HMAC pseudonym for the admin holding this role. */
  subjectPseudonym: string;
  role: AdminRoleValue;
  /** Epoch milliseconds — the wire's own `grantedAt`, never re-derived. */
  grantedAt: number;
  /** A free-text operator string (an email, or the literal `"cli"`) — never
   *  a `users` id, so it is never pseudonymized. */
  grantedBy: string;
}

export type AdminRolesLoad =
  | { state: "loading" }
  | { state: "ready"; entries: AdminRoleEntry[]; limit: number }
  /** The API could not be reached or did not answer with a usable body.
   *  Never painted as "no roles granted" — that would look like a real,
   *  observed reading, when in fact nothing was read at all. */
  | { state: "unavailable"; reason: string };

const ROLE_VALUES: readonly AdminRoleValue[] = ["operator", "qari", "moderator"];

function isAdminRoleValue(v: unknown): v is AdminRoleValue {
  return typeof v === "string" && (ROLE_VALUES as readonly string[]).includes(v);
}

function isAdminRoleEntry(v: unknown): v is AdminRoleEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.subjectPseudonym === "string" &&
    isAdminRoleValue(e.role) &&
    typeof e.grantedAt === "number" &&
    typeof e.grantedBy === "string"
  );
}

/**
 * Fetch the most recent admin-role grants, optionally narrowed by `role`
 * (the closed-set value) and/or a raw admin `userId` — the same convention
 * `lib/admin/purgeLedger.ts` and `lib/admin/billingAudit.ts` established (an
 * operator has the raw id from elsewhere, never a pseudonym, which is
 * one-way by design and cannot be reversed into an id to filter by). Never
 * throws — every failure (network, non-2xx, unparseable body, a body
 * missing the contract's fields) becomes `unavailable` with a reason an
 * operator can act on.
 */
export async function loadAdminRoles(opts?: {
  role?: AdminRoleValue;
  userId?: number;
}): Promise<AdminRolesLoad> {
  const params = new URLSearchParams();
  if (opts?.role !== undefined) params.set("role", opts.role);
  if (opts?.userId !== undefined) params.set("userId", String(opts.userId));
  const qs = params.toString();

  let response: Response;
  try {
    response = await apiFetch(`/api/admin/roles${qs ? `?${qs}` : ""}`);
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
    !((body as Record<string, unknown>).entries as unknown[]).every(isAdminRoleEntry) ||
    typeof (body as Record<string, unknown>).limit !== "number"
  ) {
    return { state: "unavailable", reason: "the API's answer carried no admin-roles list" };
  }

  const { entries, limit } = body as { entries: AdminRoleEntry[]; limit: number };
  return { state: "ready", entries, limit };
}
