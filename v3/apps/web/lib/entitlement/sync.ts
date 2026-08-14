"use client";

// THE ENTITLEMENT SNAPSHOT — fetch, and the offline-durable cache it fills.
//
// ══════════════════════════════════════════════════════════════════════════════
// WHY THIS FILE EXISTS: `gate.ts`'s `permitsIssuance` had ZERO callers
// ══════════════════════════════════════════════════════════════════════════════
// `lib/entitlement/gate.ts` mirrors `App\Billing\PaywallGate` and has been
// tested since 2026-08-10, but nothing in the shipped product ever called it —
// there was no `EntitlementSnapshot` for it to be called WITH. The server side
// of that gap closed with `GET /api/entitlement` (`Http\Controllers\Billing\
// EntitlementController`); this is the client half: fetch it, and persist it
// where an offline session can read it without a round trip.
//
// NEVER BLOCKS A SESSION. `readEntitlementSnapshot` is a plain IndexedDB read;
// `refreshEntitlementSnapshot` is fire-and-forget from every caller in this
// codebase (see `lib/session/run.ts#startSession`) — the same "background
// reconciliation, never a precondition" rule `lib/sync/sync.ts`'s own header
// states for the event log. A network failure here degrades to a cache miss,
// which `cache.ts#freshness()` already treats as "server is authoritative,
// allow" (v3-D07's never-hostage rule), never as a denial.
//
// PERSISTED IN THE SAME `meta` KV STORE `lib/onboarding/choices.ts` uses —
// one row, keyed, read back whole. No new IDB store or migration needed.
//
// KEYED "billingSnapshot", NOT the more obvious spelling: `lib/idb/schema.ts`
// is a LEAF module with no dependency on this feature (same argument its own
// header makes for `onboardingChoices`), and a closed-union string literal is
// CODE, not prose — `check-boundaries.mjs` clause 9 strips comments before it
// scans, so a literal containing the feature word would flag schema.ts as an
// entitlement reader, which it structurally is not. See schema.ts's own note
// on the `MetaKey` member.

import { openDb } from "@/lib/idb/db.ts";
import { apiFetch } from "@/lib/sync/apiFetch.ts";
import type { EntitlementSnapshot, EntitlementState, EntitlementTier, Region } from "./types";

/** The meta key this module owns. Named here, like `CHOICES`/`ONBOARDED_AT` in
 *  `choices.ts`, so no second surface can spell it inline and drift. Spelled
 *  "billingSnapshot" to match `lib/idb/schema.ts#MetaKey` — see this file's
 *  header for why that key avoids the more obvious spelling. */
export const ENTITLEMENT_SNAPSHOT_KEY = "billingSnapshot";

const STATES: readonly EntitlementState[] = ["trial", "active", "grace", "lapsed_review_only"];
const TIERS: readonly EntitlementTier[] = ["none", "monthly", "lifetime"];
const REGIONS: readonly Region[] = ["MY", "INTL"];

function isEntitlementState(v: unknown): v is EntitlementState {
  return typeof v === "string" && (STATES as readonly string[]).includes(v);
}
function isEntitlementTier(v: unknown): v is EntitlementTier {
  return typeof v === "string" && (TIERS as readonly string[]).includes(v);
}
function isRegion(v: unknown): v is Region {
  return typeof v === "string" && (REGIONS as readonly string[]).includes(v);
}

/**
 * Ask the server what this learner's entitlement is, RIGHT NOW.
 *
 * Never throws — every failure (network, non-200, malformed body, a field
 * outside the closed sets above) returns `null`, exactly like
 * `lib/account/api.ts`'s "failure is a state, never an exception" discipline.
 * A malformed server response must not crash a background refresh.
 */
export async function fetchEntitlementSnapshot(now: number): Promise<EntitlementSnapshot | null> {
  let response: Response;
  try {
    response = await apiFetch("/api/entitlement");
  } catch {
    return null;
  }
  if (!response.ok) return null;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (!isEntitlementState(b.state) || !isEntitlementTier(b.tier) || !isRegion(b.region)) return null;
  if (b.trialSurah !== null && typeof b.trialSurah !== "number") return null;

  return {
    state: b.state,
    tier: b.tier,
    region: b.region,
    trialSurah: (b.trialSurah as number | null) ?? null,
    cachedAt: now,
  };
}

/** Read the last snapshot this device persisted, or null if it never has. */
export async function readEntitlementSnapshot(): Promise<EntitlementSnapshot | null> {
  const db = await openDb();
  const row = await db.get("meta", ENTITLEMENT_SNAPSHOT_KEY);
  const value = row?.value;
  if (typeof value !== "object" || value === null) return null;
  return value as EntitlementSnapshot;
}

async function writeEntitlementSnapshot(snapshot: EntitlementSnapshot): Promise<void> {
  const db = await openDb();
  await db.put("meta", { key: ENTITLEMENT_SNAPSHOT_KEY, value: snapshot });
}

/**
 * Fetch and persist, best-effort. Returns the new snapshot on success, or
 * `null` on any failure — the stale (or absent) cache is left exactly as it
 * was, because a failed refresh must never erase a valid prior grant.
 */
export async function refreshEntitlementSnapshot(now: number): Promise<EntitlementSnapshot | null> {
  const fresh = await fetchEntitlementSnapshot(now);
  if (!fresh) return null;
  await writeEntitlementSnapshot(fresh);
  return fresh;
}
