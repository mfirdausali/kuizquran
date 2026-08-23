"use client";

// THE OVERRIDE WRITE PATH — the missing admin/qari half of the override
// layer (build-plan step 15).
//
// `OverridesController::store` (`POST /api/overrides`) has been built and
// tested on the Laravel side since the override layer shipped
// (`OverridesTest.php`: admin-gated, `field` validated against a closed
// 4-member set, `editorId` always the authenticated admin never the request
// body, append-only — a correction is a NEW row, never an edit in place) —
// but nothing under `apps/web` has ever called it. `lib/overrides/fetch.ts`
// is only the PUBLIC READ half (`GET /api/overrides`, what a learner's
// corpus loader consumes). DECISIONS.md v3-D125 names the gap exactly:
// "there is still no UI anywhere for an admin/qari to actually correct a
// gloss or distractor... workbench signs verifications only, never writes
// an override." This module is that missing write half.
//
// EGRESS: through `apiFetch` only (check-boundaries.mjs clause 6), same as
// every other admin write module (`lib/admin/flags.ts`, `lib/workbench/sign.ts`).
//
// NEVER THROWS — same discipline as `signAyah`/`killFlag`/`enableFlag`: an
// admin correcting a gloss must never meet a stack trace, and a thrown error
// mid-correction is indistinguishable from a successful one to the person
// sitting there.

import { apiFetch } from "@/lib/sync/apiFetch.ts";
import type { OverrideField, QuestionOverride } from "@engine/overrides.ts";

export interface SubmitOverrideInput {
  surah: number;
  ayah: number;
  position: number | null;
  questionType: string;
  field: OverrideField;
  payload: unknown;
  note?: string;
}

export type SubmitOverrideResult =
  | { state: "created"; override: QuestionOverride }
  | { state: "failed"; reason: string };

async function readErrorReason(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown; message?: unknown; errors?: unknown };
    if (typeof body.error === "string") return body.error;
    if (typeof body.errors === "object" && body.errors !== null) {
      const first = Object.values(body.errors as Record<string, unknown>)[0];
      if (Array.isArray(first) && typeof first[0] === "string") return first[0];
    }
    if (typeof body.message === "string") return body.message;
  } catch {
    // fall through to the status-code reason below
  }
  return `the API answered ${response.status}`;
}

/**
 * Write one override row. Mirrors `signAyah`'s and `killFlag`'s shape: a
 * typed outcome, never a throw, the server's own message surfaced verbatim
 * rather than re-derived.
 */
export async function submitOverride(input: SubmitOverrideInput): Promise<SubmitOverrideResult> {
  let response: Response;
  try {
    response = await apiFetch("/api/overrides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        surah: input.surah,
        ayah: input.ayah,
        position: input.position,
        questionType: input.questionType,
        field: input.field,
        payload: input.payload,
        note: input.note ?? null,
      }),
    });
  } catch (err) {
    return { state: "failed", reason: err instanceof Error ? `request failed: ${err.message}` : "request failed" };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      state: "failed",
      reason: "not authorised to write an override — this account is not on the admin allowlist",
    };
  }
  if (!response.ok) {
    return { state: "failed", reason: await readErrorReason(response) };
  }

  let override: QuestionOverride;
  try {
    const body = (await response.json()) as { override?: QuestionOverride };
    if (!body?.override) {
      return { state: "failed", reason: "the API accepted the override but returned no row" };
    }
    override = body.override;
  } catch {
    return { state: "failed", reason: "the API's answer was not JSON" };
  }

  return { state: "created", override };
}

/**
 * Correct one word's gloss for one language. `questionType` is irrelevant to
 * gloss resolution (`applyOverrides` keys gloss overrides on
 * `ayah:position:lang` alone) but the server still requires the field
 * non-empty, so this always stamps `"s1"` — the workbench's own lowercase
 * lane-name convention (`WorkbenchIsland.PICKABLE_LANES`), since a gloss
 * correction is most directly a meaning (S1) correction.
 */
export function glossOverride(
  surah: number,
  ayah: number,
  position: number,
  lang: "en" | "ms",
  text: string,
  note?: string,
): SubmitOverrideInput {
  return { surah, ayah, position, questionType: "s1", field: "gloss", payload: { lang, text }, note };
}

/**
 * Disable (or, with `disabled: false`, re-enable) one questionType at
 * (ayah, position). `position: null` covers every position of that
 * questionType — `isQuestionDisabled`'s own ayah-wide rule. Re-enabling is
 * NEVER an edit in place: it is a later row with `disabled: false`, matching
 * `DisablePayload`'s own append-only contract.
 */
export function disableOverride(
  surah: number,
  ayah: number,
  position: number | null,
  questionType: string,
  disabled: boolean,
  note?: string,
): SubmitOverrideInput {
  return { surah, ayah, position, questionType, field: "disable", payload: { disabled }, note };
}
