// Streak pill (FR9). Quiet by design — de-emphasize length (PRD anti-pattern:
// streak-as-idol); no guilt copy. Reuses engine computeStreak. Consumes
// .pill-streak from iman-ui.css.

import type { StreakState } from "engine";

export function Streak({ streak }: { streak: StreakState }) {
  if (streak.length === 0) return null;
  let text = `🔥 ${streak.length}`;
  if (streak.atRisk) text = `🔥 ${streak.length} · today's open`;
  else if (streak.pausedOnMiss)
    text = streak.makeupAvailable ? `🔥 ${streak.length} · make-up today` : `🔥 ${streak.length} · paused`;
  return <span className="pill-streak">{text}</span>;
}
