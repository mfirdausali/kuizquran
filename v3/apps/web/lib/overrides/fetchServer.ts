// FETCH OVERRIDES — the SERVER-SIDE read half of the override layer.
//
// The SSR counterpart to `lib/overrides/fetch.ts` (v3-D96's client fix). That
// module is `"use client"` and reaches `GET /api/overrides` through
// `lib/sync/apiFetch.ts` — the browser's Bearer-token/401-remint machinery,
// which has no meaning on the server (no localStorage, no anonymous device to
// mint) and which a Server Component cannot even import: a "use client"
// module's plain exports resolve to a client-reference proxy across that
// boundary, not the function itself (see `lib/corpus/staged.ts`'s own account
// of this exact failure mode for a constant; the same rule applies here).
//
// `GET /api/overrides` is a PUBLIC, unauthenticated read
// (`OverridesController::index` carries no `admin` middleware — verified by
// reading `routes/api.php`), so none of `apiFetch`'s auth machinery is
// actually needed to reach it; this module is a plain, small, server-only
// fetch, not a second copy of the interceptor. `isOverride`'s shape guard is
// duplicated from `fetch.ts` rather than imported, for the same "use client"
// boundary reason — the two copies are small and this file's own tests pin
// that they accept the same shape.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTED AS A GAP UNTIL NOW
// ---------------------------------------------------------------------------
// `lib/corpus/load.ts#loadCorpus` (the SSR reader behind `/plan`, `/progress`,
// `/progress/list`, `/surah/[surah]`, `/surah/[surah]/[ayah]`, `/drill`,
// `/practice` and `/workbench`) has always read the raw compiled corpus off
// disk with no override merge. v3-D96 fixed the CLIENT half of this same gap
// (`lib/corpus/client.ts#fetchCorpus`) and its own closing note named the SSR
// half explicitly as "deliberately NOT done... this codebase has no
// established pattern for the Next.js server to call the Laravel API over
// HTTP" — real then, since nothing else in this app made a server-to-server
// call. This module is that pattern's first, narrowly-scoped instance.
//
// Never throws, same discipline as every other override/entitlement
// background fetch in this codebase (#103): a network failure or a malformed
// body degrades to `[]` — no overrides applied, the raw corpus stands.

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
 * Base URL for server-to-server calls into the Laravel API. Deliberately NOT
 * `NEXT_PUBLIC_`-prefixed — it is read only in server code and has no reason
 * to reach the client bundle. Defaults to `dev-api3`'s documented dev port
 * (root `Makefile`: "Run only v3's API (:8001)") — the only port this repo
 * names anywhere for v3's API. Gate 20 (LAUNCH-CHECKLIST.md, hosting) has not
 * yet decided the real staging/production shape (reverse proxy vs. a direct
 * backend URL); this default is a reasonable placeholder for local
 * development, not a claim that gate 20 is resolved.
 */
function serverApiBase(): string {
  return process.env.API_BASE_URL ?? "http://localhost:8001";
}

/**
 * All override rows for one surah, as `applyOverrides` expects them —
 * unfiltered by field, precedence resolution is entirely `applyOverrides`'s
 * job. A row failing the shape check is dropped rather than crashing the
 * whole fetch: one malformed row must not blind a caller to every other
 * valid correction. Mirrors `lib/overrides/fetch.ts#fetchOverrides` exactly,
 * for the server side.
 */
export async function fetchServerOverrides(surah: number): Promise<QuestionOverride[]> {
  let response: Response;
  try {
    response = await fetch(`${serverApiBase()}/api/overrides?surah=${surah}`);
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
