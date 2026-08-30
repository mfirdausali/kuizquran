"use client";

// THE MS GLOSS DRAFT WORKFLOW CLIENT — the missing frontend half of
// `Admin\GlossDraftsController` (build-plan step 27, M9).
//
// The backend (migration, model, controller, `GET/POST /api/admin/gloss-drafts`,
// `POST /api/admin/gloss-drafts/{id}/review`) has been live and fully tested
// (`Tests\Feature\GlossDrafts\GlossDraftsTest`, `GlossDraftIsolationTest`) since
// build-plan step 27 shipped, but nothing under `apps/web` has ever called it —
// every CLAUDE.md nightly note since has listed `GlossDraftsController` as
// "ratification-gated" and left it alone.
//
// THAT NAMING WAS TOO WIDE. Re-reading the actual gate (BUILD-PLAN's agent-
// deployment rule, `GlossDraftsController`'s own docblock, and the migration's
// own comment): what needs Firdaus's ratification is AUTHORING MALAY GLOSS
// CONTENT into this table. The table already ships EMPTY — no seeder exists —
// and `GlossDraftsTest::test_the_gloss_draft_table_ships_empty` asserts that
// emptiness is real. Building the WORKFLOW TOOL a human uses to draft/review
// through does not author anything itself: it stays exactly as empty as it was
// the moment this module is deployed, and only a human typing into the form
// this module drives ever adds a row — precisely the "scaffold, not content"
// reading BUILD-PLAN's own rule draws ("agents may draft into a flagged
// non-shipping table only if Firdaus ratifies that; scaffold-empty otherwise").
// This module and its panel ARE the scaffold, still empty until a human uses
// them, same as `OverrideEditor`/`FlagsPanel`/every other admin write surface
// this build has wired without ever writing the CONTENT a human types into it.
//
// EGRESS: through `apiFetch` only (check-boundaries.mjs clause 6), same as
// every other admin module.
//
// READS FAIL AS A STATE, NEVER AN EXCEPTION — same discipline as
// `loadPurgeLedger`/`loadFlagAudit`/`loadBillingAudit`. WRITES NEVER THROW —
// same discipline as `submitOverride`/`killFlag`/`signAyah`: an admin drafting
// or reviewing a gloss must never meet a stack trace.
//
// NO ARABIC, NO MALAY CONTENT IS WRITTEN HERE. Every string this file emits is
// English prose about the workflow itself; the `text` an admin drafts is free
// text they type through the panel this module drives — this module supplies
// not one byte of gloss content of its own.

import { apiFetch } from "@/lib/sync/apiFetch.ts";

export type GlossDraftStatus = "draft" | "reviewed" | "merged";
export type GlossDraftAuthorKind = "ai" | "human";

/**
 * One row of `gloss_draft_reviews` — the migration's own APPEND-ONLY
 * "how it got there" transition history, as opposed to `GlossDraftRow`'s
 * current-state fields. Chronological, oldest first, as the controller's
 * `toWire()` emits it.
 */
export interface GlossDraftReviewRow {
  fromStatus: GlossDraftStatus;
  toStatus: GlossDraftStatus;
  textAtReview: string | null;
  actorKind: GlossDraftAuthorKind;
  actor: string | null;
  note: string | null;
  createdAt: number;
}

export interface GlossDraftRow {
  id: number;
  surah: number;
  ayah: number;
  position: number;
  lang: string;
  text: string | null;
  status: GlossDraftStatus;
  authorKind: GlossDraftAuthorKind;
  authoredBy: string | null;
  reviewedBy: string | null;
  reviewedAt: number | null;
  note: string | null;
  createdAt: number;
  updatedAt: number;
  /** Absent only if the server predates this field — never fabricated. */
  reviews?: GlossDraftReviewRow[];
}

export interface GlossDraftCounts {
  draft: number;
  reviewed: number;
  merged: number;
  unauthored: number;
}

export type GlossDraftsLoad =
  | { state: "loading" }
  | {
      state: "ready";
      surah: number;
      lang: string;
      /** Mirrors the controller's own wire field verbatim — this surface
       *  never ships to a learner, at every point in the workflow. */
      shipping: boolean;
      excludedFromHashV1: boolean;
      counts: GlossDraftCounts;
      drafts: GlossDraftRow[];
    }
  | { state: "unavailable"; reason: string };

function isGlossDraftRow(v: unknown): v is GlossDraftRow {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === "number" &&
    typeof r.surah === "number" &&
    typeof r.ayah === "number" &&
    typeof r.position === "number" &&
    typeof r.lang === "string" &&
    (r.text === null || typeof r.text === "string") &&
    typeof r.status === "string" &&
    typeof r.authorKind === "string"
  );
}

/**
 * Fetch the review worklist for one surah/lang. Never throws — every failure
 * (network, non-2xx, unparseable body, a body missing the contract's fields)
 * becomes `unavailable` with a reason an operator can act on.
 */
export async function loadGlossDrafts(surah: number, lang: string): Promise<GlossDraftsLoad> {
  let response: Response;
  try {
    response = await apiFetch(
      `/api/admin/gloss-drafts?surah=${encodeURIComponent(String(surah))}&lang=${encodeURIComponent(lang)}`,
    );
  } catch (err) {
    return {
      state: "unavailable",
      reason: err instanceof Error ? `request failed: ${err.message}` : "request failed",
    };
  }

  if (response.status === 401 || response.status === 403) {
    return { state: "unavailable", reason: "this screen requires an admin account" };
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

  if (
    typeof body !== "object" ||
    body === null ||
    !("drafts" in body) ||
    !Array.isArray((body as Record<string, unknown>).drafts) ||
    !((body as Record<string, unknown>).drafts as unknown[]).every(isGlossDraftRow) ||
    typeof (body as Record<string, unknown>).counts !== "object"
  ) {
    return { state: "unavailable", reason: "the API's answer carried no gloss-draft worklist" };
  }

  const b = body as {
    surah: number;
    lang: string;
    shipping: boolean;
    excludedFromHashV1: boolean;
    counts: GlossDraftCounts;
    drafts: GlossDraftRow[];
  };
  return {
    state: "ready",
    surah: b.surah,
    lang: b.lang,
    shipping: b.shipping,
    excludedFromHashV1: b.excludedFromHashV1,
    counts: b.counts,
    drafts: b.drafts,
  };
}

async function readErrorReason(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    // fall through to the status-code reason below
  }
  return `the API answered ${response.status}`;
}

export interface SaveGlossDraftInput {
  surah: number;
  ayah: number;
  position: number;
  lang: string;
  text: string | null;
  authorKind: GlossDraftAuthorKind;
  note?: string;
}

export type SaveGlossDraftResult =
  | { state: "saved"; draft: GlossDraftRow }
  | { state: "failed"; reason: string };

/**
 * Create or edit a draft — an upsert on (surah, ayah, position, lang), same
 * as the controller's own `store()`. Editing a REVIEWED row returns it to
 * `draft` server-side; this function reports whatever status the server
 * hands back, never a status it computed itself.
 */
export async function saveGlossDraft(input: SaveGlossDraftInput): Promise<SaveGlossDraftResult> {
  let response: Response;
  try {
    response = await apiFetch("/api/admin/gloss-drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        surah: input.surah,
        ayah: input.ayah,
        position: input.position,
        lang: input.lang,
        text: input.text,
        authorKind: input.authorKind,
        note: input.note ?? null,
      }),
    });
  } catch (err) {
    return { state: "failed", reason: err instanceof Error ? `request failed: ${err.message}` : "request failed" };
  }

  if (response.status === 401 || response.status === 403) {
    return { state: "failed", reason: "not authorised to draft a gloss — this account is not on the admin allowlist" };
  }
  if (!response.ok) {
    return { state: "failed", reason: await readErrorReason(response) };
  }

  try {
    const body = (await response.json()) as { draft?: GlossDraftRow };
    if (!body?.draft) return { state: "failed", reason: "the API accepted the draft but returned no row" };
    return { state: "saved", draft: body.draft };
  } catch {
    return { state: "failed", reason: "the API's answer was not JSON" };
  }
}

export interface ReviewGlossDraftInput {
  toStatus: GlossDraftStatus;
  actorKind: GlossDraftAuthorKind;
  note?: string;
}

export type ReviewGlossDraftResult =
  | { state: "updated"; draft: GlossDraftRow }
  | { state: "failed"; reason: string };

/**
 * Move a draft through the workflow. `toStatus: "merged"` is REFUSED by the
 * server unconditionally at hash v1 (v3-D15) — this function does not special-
 * case that locally; it surfaces whatever the server says, verbatim, the same
 * discipline `submitOverride` already follows.
 */
export async function reviewGlossDraft(id: number, input: ReviewGlossDraftInput): Promise<ReviewGlossDraftResult> {
  let response: Response;
  try {
    response = await apiFetch(`/api/admin/gloss-drafts/${id}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toStatus: input.toStatus, actorKind: input.actorKind, note: input.note ?? null }),
    });
  } catch (err) {
    return { state: "failed", reason: err instanceof Error ? `request failed: ${err.message}` : "request failed" };
  }

  if (response.status === 401 || response.status === 403) {
    return { state: "failed", reason: "not authorised to review a gloss draft — this account is not on the admin allowlist" };
  }
  if (!response.ok) {
    return { state: "failed", reason: await readErrorReason(response) };
  }

  try {
    const body = (await response.json()) as { draft?: GlossDraftRow };
    if (!body?.draft) return { state: "failed", reason: "the API accepted the review but returned no row" };
    return { state: "updated", draft: body.draft };
  } catch {
    return { state: "failed", reason: "the API's answer was not JSON" };
  }
}
