"use client";

// The payload digest — #50's "skip only on payload-digest match" primitive.
//
// This is a small function with a real trap behind it, and the trap is on the
// SERVER side of the round trip. `EventsController::toWire()` emits a field
// only `if ($value !== null)`:
//
//     $set = function (string $wireField, $value) use (&$e) {
//         if ($value !== null) { $e[$wireField] = $value; }
//     };
//
// So an event pushed with `latency: null` comes back with NO `latency` key at
// all. A naive `JSON.stringify` digest would therefore report a divergence on
// EVERY round-tripped event that had an explicit null, and #50's alert would
// fire constantly — the fastest possible way to train everyone to ignore it.
//
// Therefore the normalization has exactly two obligations, and both are
// load-bearing:
//
//   1. ABSENT === NULL === UNDEFINED. A key whose value is null/undefined is
//      dropped entirely, so `{a:1, b:null}` and `{a:1}` digest identically.
//   2. KEY ORDER IS IRRELEVANT. Keys are sorted at every level, so
//      `{a:1,b:2}` and `{b:2,a:1}` digest identically. JS object key order is
//      insertion order, and a row that came from IndexedDB has whatever order
//      the structured clone produced — not the order the server's json_encode
//      produced.
//
// The digest is computed over the WIRE shape only (`toWire()` first), so the
// local-only `syncedAt` never participates. A local row that is pending and
// the same row after being marked synced MUST digest identically, or every
// re-merge would look like a divergence.

import type { DrillEvent } from "@engine/types.ts";
import { toWire, type LocalEventRow } from "@/lib/idb/schema";

/**
 * Canonical JSON: sorted keys at every level, null/undefined-valued keys
 * dropped, arrays kept in order (array order IS meaning).
 *
 * Recursive rather than a one-level pass because `specSnapshot` is a
 * `Record<string, unknown>` of unbounded shape — a one-level sort would leave
 * its inner key order dependent on however the JSON came back.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(value: unknown): unknown {
  // null and undefined collapse to the SAME sentinel. They only ever appear
  // here as array members (object members carrying them are dropped below);
  // an array is positional, so we cannot drop them without shifting indices.
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    const v = source[key];
    // Obligation 1: an explicitly-null field and an absent field are the same
    // fact. This is the line that keeps #50's alert from firing on every
    // round-tripped event.
    if (v === null || v === undefined) continue;
    out[key] = normalize(v);
  }
  return out;
}

/**
 * The digest of one event's WIRE payload.
 *
 * Accepts either a stored row or a wire event: `toWire` strips `syncedAt` if
 * present and is a no-op otherwise, so a pending row and its synced self
 * digest identically.
 *
 * The digest string is the canonical JSON itself rather than a hash. There is
 * no cryptographic requirement here — this compares two payloads for equality
 * on one device, it never crosses a trust boundary — and a readable digest is
 * what makes a #50 divergence report diagnosable instead of two opaque hex
 * strings. Hashing would only add a collision mode.
 */
export function eventDigest(row: LocalEventRow | DrillEvent): string {
  return canonicalJson(toWire(row as LocalEventRow));
}

/** Whether two events carry the same wire payload. */
export function digestsMatch(
  a: LocalEventRow | DrillEvent,
  b: LocalEventRow | DrillEvent,
): boolean {
  return eventDigest(a) === eventDigest(b);
}
