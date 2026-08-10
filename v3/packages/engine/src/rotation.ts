// WIREFRAME.md §23 Q2: lane rotation. "Rotation is lane-first, then an
// affine cycle within the lane. lapPerm hash-permutes the L lanes per lap,
// so every lane fires exactly once per lap (no starvation, structurally)
// while lap order differs every lap (variety). stride(N) is computed in
// integer arithmetic — no float on the selection path." And: "The seam
// guard must be a rotation, not a swap — the swap was measured failing at
// L=2 with 59 immediate repeats."
//
// This file implements ONLY the rotation MECHANISM, proven by property
// (every lane visited exactly once per lap, zero immediate repeats at any
// lap boundary, full within-lane pool coverage before any repeat, no RNG —
// INVARIANTS.md Absolute A). It does not wire this to a real lane/variant
// list: that requires M4's question compiler to define a concrete Variant
// shape first (see DECISIONS.md's step-11 scope entry) — build-plan step 12
// (selection_determinism_check) is where this mechanism gets a real caller.

function hash32(seed: number): number {
  let x = seed | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = x ^ (x >>> 16);
  return x >>> 0;
}

function gcd(a: number, b: number): number {
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

/** A fixed (per seedKey) shuffle of [0..laneCount-1] — the base every lap
 *  rotates. Fisher-Yates driven by hash32, never Math.random (INVARIANTS.md
 *  Absolute A) — deterministic and replay-safe across devices given the
 *  same seedKey (e.g. a site's own key, so different sites don't share one
 *  lap-order sequence). */
function basePermutation(laneCount: number, seedKey: number): number[] {
  const perm = Array.from({ length: laneCount }, (_, i) => i);
  let state = hash32(seedKey * 2654435761);
  for (let i = laneCount - 1; i > 0; i--) {
    state = hash32(state);
    const j = state % (i + 1);
    [perm[i], perm[j]] = [perm[j]!, perm[i]!];
  }
  return perm;
}

/**
 * lapPerm: a deterministic permutation of lane indices [0..laneCount-1] for
 * a given lap — every lane fires exactly once per lap (no starvation,
 * structurally).
 *
 * For laneCount >= 3: each lap rotates a fixed base permutation by
 * `lap mod laneCount`. Rotating by 1 each lap never places the same lane at
 * a lap boundary — for a rotation amount r_i = i mod L, the boundary
 * condition `base[(L-1+r_i) mod L] === base[(r_{i+1}) mod L]` reduces to
 * `L | 2`, which is false for L >= 3 — and gives `laneCount` distinct lap
 * orders before cycling (the "variety" WIREFRAME asks for).
 *
 * For laneCount <= 2 the base is never rotated: with only 1-2 lanes, the
 * only boundary-repeat-free sequencing IS the fixed alternation (A,B,A,B,...
 * for L=2; the forced A,A,A,... for L=1, edge case #40's explicit carve-out
 * — a single lane has nothing else to visit). Rotating a 2-element base
 * would alternate [A,B],[B,A],[A,B],... whose boundaries collide (B,B then
 * A,A) — the exact "swap" failure mode WIREFRAME measured at L=2.
 */
export function lapPerm(lap: number, laneCount: number, seedKey: number): number[] {
  if (laneCount <= 0) return [];
  const base = basePermutation(laneCount, seedKey);
  if (laneCount <= 2) return base;
  const rotateBy = ((lap % laneCount) + laneCount) % laneCount;
  return base.map((_, i) => base[(i + rotateBy) % laneCount]!);
}

/**
 * stride: an integer step coprime with `poolSize`, for an affine cycle over
 * a variant pool (see {@link affineIndex}). Coprimality guarantees the
 * cycle visits every pool index exactly once before repeating. Pure integer
 * arithmetic — no float on the selection path (INVARIANTS.md Absolute A).
 * `poolSize - 1` is always coprime with `poolSize` (consecutive integers
 * always are), so a coprime step always exists for poolSize >= 3.
 */
export function stride(poolSize: number): number {
  if (poolSize <= 2) return 1;
  for (let s = Math.floor(poolSize / 2) + 1; s < poolSize; s++) {
    if (gcd(s, poolSize) === 1) return s;
  }
  return 1;
}

/**
 * affineIndex: which pool index (0-based) to serve at visit `n`, for a pool
 * of size `poolSize`, optionally offset (e.g. a per-lane starting point so
 * different lanes don't all start at index 0).
 * `(n * stride(poolSize) + offset) mod poolSize` — because the stride is
 * coprime with poolSize, multiplication by it is a bijection over
 * Z/poolSize: every index is visited exactly once per poolSize visits (full
 * coverage before any repeat), and for poolSize > 1 it never repeats the
 * immediately-prior index (WIREFRAME: "a rotation, not a swap").
 *
 * Throws on a non-positive poolSize — a caller bug (an empty or negative
 * pool), not a runtime condition to silently clamp away.
 */
export function affineIndex(n: number, poolSize: number, offset = 0): number {
  if (poolSize <= 0) throw new Error(`affineIndex: poolSize must be > 0, got ${poolSize}`);
  return (((n * stride(poolSize) + offset) % poolSize) + poolSize) % poolSize;
}
