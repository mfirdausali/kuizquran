"use client";

// FETCH OVERRIDES — the client-side read half of the override layer.
//
// `packages/engine/src/overrides.ts#applyOverrides` is the ONE place override
// precedence is decided (its own docblock: "callers just pass the patched
// corpus instead of the raw one"). `GET /api/overrides` is a PUBLIC read
// (`OversidesController::index`'s own docblock: "every client, including an
// anonymous not-yet-synced device, needs these to build correct questions").
// Nothing between the two existed: `lib/corpus/client.ts#fetchCorpus` served
// the raw compiled corpus straight to `SessionIsland`, so a qari/admin
// correction (a fixed gloss, a swapped distractor, a disabled broken
// question) never reached a learner actually being graded. This module
// closes that gap's read side; `fetchCorpus` is the caller.
//
// Same failure discipline as `lib/entitlement/sync.ts#fetchEntitlementSnapshot`:
// never throws. A network failure or a malformed body degrades to `[]` — no
// overrides applied, the raw corpus stands — never a crash mid-session
// (#103, the same "never blocks" rule every other background fetch in this
// codebase follows).

import { apiFetch } from "@/lib/sync/apiFetch.ts";
import type { QuestionOverride, OverrideField } from "@engine/overrides.ts";

const CLOSED_FIELDS: readonly OverrideField[] = ["gloss", "distractor", "group", "disable"];

function isOverride(v: unknown): v is QuestionOverride {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.surah === "number" &&
    typeof o.ayah === "number" &&
    (o.position === null || typeof o.position === "number") &&
    typeof o.questionType === "string" &&
    typeof o.field === "string" &&
    (CLOSED_FIELDS as readonly string[]).includes(o.field) &&
    "payload" in o &&
    typeof o.createdAt === "number"
  );
}

/**
 * All override rows for one surah, as `applyOverrides` expects them —
 * unfiltered by field, precedence resolution is entirely `applyOverrides`'s
 * job. A row failing the shape check is dropped rather than crashing the
 * whole fetch: one malformed row must not blind a caller to every other
 * valid correction.
 */
export async function fetchOverrides(surah: number): Promise<QuestionOverride[]> {
  let response: Response;
  try {
    response = await apiFetch(`/api/overrides?surah=${surah}`);
  } catch {
    return [];
  }
  if (!response.ok) return [];

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return [];
  }
  if (typeof body !== "object" || body === null) return [];
  const rows = (body as Record<string, unknown>).overrides;
  if (!Array.isArray(rows)) return [];
  return rows.filter(isOverride);
}
