// Placement result persistence (FR10, ROADMAP Phase 3) — the carried map + start
// ayah decided by the onboarding binary-search (engine/src/placement.ts) is
// cached locally so useSession can seed the learn window without re-deriving it
// from the event log's placement_result event on every plan(). The event log
// stays the durable truth (placement_probe/placement_result, invariant #2); this
// is a read-through cache, ported from v1's onboarding/useOnboarding.ts pattern.

const KEY = "iman-placement";

export interface StoredPlacement {
  carriedAyat: number[];
  startAyah: number;
  ayahPerDay: number;
}

export function loadPlacement(): StoredPlacement | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredPlacement) : null;
  } catch {
    return null;
  }
}

export function savePlacement(p: StoredPlacement): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* non-fatal */
  }
}

export function clearPlacement(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(KEY);
}
