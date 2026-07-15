// Deterministic display shuffle. The engine returns options/tiles in a stable
// order (correct first); the UI must not leak the answer via position, but must
// also stay reproducible across re-renders. We seed by a string key so the same
// item always renders the same order within a session.

function hashSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Fisher–Yates with a seeded LCG. Returns a new array. */
export function seededShuffle<T>(items: T[], key: string): T[] {
  let s = hashSeed(key) || 1;
  const next = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
