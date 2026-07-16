// Anchor-hour persistence (FR9/FR10) — ONE scheduling question at onboarding: a
// daily TIME anchor, kept secular (no prayer names). Local-only for now (v1 also
// posted this to /settings when signed in; v2's Laravel backend + auth lands in
// Phase 5 — see the v2-D34 decision logged alongside this file). Pure localStorage
// IO; no scheduling logic lives here (invariant #6).

const KEY = "iman-anchor-hour";

/** A short list of friendly anchor times (hour of day, 24h; half-hours allowed). */
export const ANCHOR_CHOICES: { label: string; hour: number }[] = [
  { label: "Early morning", hour: 5.5 },
  { label: "After breakfast", hour: 8 },
  { label: "Midday", hour: 13 },
  { label: "Late afternoon", hour: 17 },
  { label: "Evening", hour: 20 },
  { label: "Before sleep", hour: 22.5 },
];

export function getAnchorHour(): number | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function setAnchorHour(hour: number): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, String(hour));
}

export function clearAnchorHour(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(KEY);
}
