// §3 success-metric computations (FR8). Each reads D1 (read-only) and returns a
// MetricResult. Pure aggregation SQL; no mutation. The admin page renders these.
//
// D30 retention is time-gated (needs 30 real days + probes) — it returns an
// honest "accrues" status rather than a fabricated number.

const DAY_MS = 86_400_000;
const ROLLOVER_HOUR = 4.5; // secular day boundary (matches engine DEFAULT_DAY_CONFIG)

export interface MetricResult {
  key: string;
  label: string;
  /** Rendered value, e.g. "87%" or "2.3", or null when not yet available. */
  value: string | null;
  /** PRD §3 target text. */
  target: string;
  /** Sample size (rows the metric is based on). */
  n: number;
  /** When value is null, what's missing (honesty per FR8). */
  note?: string;
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** learning-day index for a ms timestamp, using the secular rollover. */
function learningDay(ts: number): number {
  return Math.floor((ts - ROLLOVER_HOUR * 3600_000) / DAY_MS);
}

// ---- 1. Day-1 gate pass rate ----
export async function gatePassRate(db: D1Database): Promise<MetricResult> {
  const row = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) AS passed,
         COUNT(*) AS total
       FROM events WHERE type = 'gate_result'`,
    )
    .first<{ passed: number | null; total: number }>();
  const total = row?.total ?? 0;
  const passed = row?.passed ?? 0;
  return {
    key: "gate_pass",
    label: "Day-1 gate pass rate",
    value: total > 0 ? pct(passed / total) : null,
    target: "85–90%",
    n: total,
    note: total === 0 ? "no cold gates attempted yet" : undefined,
  };
}

// ---- 2. Cycles-to-clean-pass ----
// Avg number of rung_start events per (user,ayah) before the S3 rung_complete.
export async function cyclesToCleanPass(db: D1Database): Promise<MetricResult> {
  const row = await db
    .prepare(
      `WITH encoded AS (
         SELECT user_id, ayah, MIN(ts) AS done_ts
         FROM events WHERE type = 'rung_complete' AND rung = 'S3'
         GROUP BY user_id, ayah
       ),
       starts AS (
         SELECT e.user_id, e.ayah, COUNT(*) AS cycles
         FROM events e JOIN encoded en
           ON e.user_id = en.user_id AND e.ayah = en.ayah
         WHERE e.type = 'rung_start' AND e.ts <= en.done_ts
         GROUP BY e.user_id, e.ayah
       )
       SELECT AVG(cycles) AS avg_cycles, COUNT(*) AS n FROM starts`,
    )
    .first<{ avg_cycles: number | null; n: number }>();
  const n = row?.n ?? 0;
  return {
    key: "cycles",
    label: "Cycles-to-clean-pass",
    value: n > 0 && row?.avg_cycles != null ? row.avg_cycles.toFixed(1) : null,
    target: "converging distribution",
    n,
    note: n === 0 ? "no ayah encoded yet" : undefined,
  };
}

// ---- 3. Time-per-word (median tap latency, interrupted taps excluded) ----
export async function timePerWord(db: D1Database): Promise<MetricResult> {
  // D1/SQLite has no median() — pull latencies and compute in JS. Exclude taps
  // that carry no latency (older events) and any obviously-interrupted ones
  // (latency > 5 min, treated as a walk-away — matches "interrupted latencies
  // discarded").
  const rows = await db
    .prepare(
      `SELECT latency FROM events
       WHERE type = 'tap' AND latency IS NOT NULL AND latency <= 300000
       ORDER BY latency`,
    )
    .all<{ latency: number }>();
  const arr = rows.results.map((r) => r.latency);
  if (arr.length === 0) {
    return {
      key: "time_per_word",
      label: "Time-per-word",
      value: null,
      target: "~20 s (correct with real constant)",
      n: 0,
      note: "no timed taps yet",
    };
  }
  const mid = Math.floor(arr.length / 2);
  const median = arr.length % 2 ? arr[mid]! : (arr[mid - 1]! + arr[mid]!) / 2;
  return {
    key: "time_per_word",
    label: "Time-per-word",
    value: `${(median / 1000).toFixed(1)} s`,
    target: "~20 s (correct with real constant)",
    n: arr.length,
  };
}

// ---- 4. Anchor adherence ----
// Fraction of a user's active learning-days whose FIRST event fell within 90 min
// of that user's anchor_hour.
export async function anchorAdherence(db: D1Database): Promise<MetricResult> {
  const rows = await db
    .prepare(
      `SELECT e.user_id, e.ts, u.anchor_hour
       FROM events e JOIN users u ON u.id = e.user_id
       ORDER BY e.user_id, e.ts`,
    )
    .all<{ user_id: number; ts: number; anchor_hour: number }>();
  // first event per (user, learning-day)
  const firstByDay = new Map<string, { ts: number; anchor: number }>();
  for (const r of rows.results) {
    const key = `${r.user_id}:${learningDay(r.ts)}`;
    if (!firstByDay.has(key)) firstByDay.set(key, { ts: r.ts, anchor: r.anchor_hour });
  }
  const days = [...firstByDay.values()];
  if (days.length === 0) {
    return {
      key: "anchor",
      label: "Anchor adherence",
      value: null,
      target: "≥60% of active days",
      n: 0,
      note: "no active days yet",
    };
  }
  let within = 0;
  for (const d of days) {
    const local = new Date(d.ts);
    const hourOfDay = local.getHours() + local.getMinutes() / 60;
    const diff = Math.abs(hourOfDay - d.anchor);
    if (Math.min(diff, 24 - diff) <= 1.5) within++; // 90 min
  }
  return {
    key: "anchor",
    label: "Anchor adherence",
    value: pct(within / days.length),
    target: "≥60% of active days",
    n: days.length,
  };
}

// ---- 5. Interruption → completion ----
// Of learning-days with ≥1 interruption event, fraction that still reached
// ayah_complete that same day.
export async function interruptionCompletion(db: D1Database): Promise<MetricResult> {
  const interruptions = await db
    .prepare(`SELECT user_id, ts FROM events WHERE type = 'interruption'`)
    .all<{ user_id: number; ts: number }>();
  const completes = await db
    .prepare(`SELECT user_id, ts FROM events WHERE type = 'ayah_complete'`)
    .all<{ user_id: number; ts: number }>();
  const interruptedDays = new Set(
    interruptions.results.map((r) => `${r.user_id}:${learningDay(r.ts)}`),
  );
  const completedDays = new Set(completes.results.map((r) => `${r.user_id}:${learningDay(r.ts)}`));
  const n = interruptedDays.size;
  if (n === 0) {
    return {
      key: "interruption",
      label: "Interruption → completion",
      value: null,
      target: "≥80% finish same day",
      n: 0,
      note: "no interrupted sessions yet",
    };
  }
  let finished = 0;
  for (const d of interruptedDays) if (completedDays.has(d)) finished++;
  return {
    key: "interruption",
    label: "Interruption → completion",
    value: pct(finished / n),
    target: "≥80% finish same day",
    n,
  };
}

// ---- 6. Look-alike slip rate ----
// Wrong-tap 'choice' counts grouped by (target word, chosen distractor). The
// headline value = overall slip rate (wrong taps / all graded taps); the pairs
// feed the drill-down.
export async function lookAlikeSlipRate(db: D1Database): Promise<MetricResult> {
  const row = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN correct = 0 THEN 1 ELSE 0 END) AS slips,
         COUNT(*) AS total
       FROM events
       WHERE type = 'tap' AND correct IS NOT NULL AND (pretest IS NULL OR pretest = 0)`,
    )
    .first<{ slips: number | null; total: number }>();
  const total = row?.total ?? 0;
  const slips = row?.slips ?? 0;
  return {
    key: "slip_rate",
    label: "Look-alike slip rate",
    value: total > 0 ? pct(slips / total) : null,
    target: "declining per confused pair",
    n: total,
    note: total === 0 ? "no graded taps yet" : undefined,
  };
}

/** Top confusion pairs (target ← chosen) for the drill-down. */
export async function confusionPairs(
  db: D1Database,
  limit = 10,
): Promise<{ position: number; ayah: number; chosen: string; count: number }[]> {
  const rows = await db
    .prepare(
      `SELECT ayah, position, choice AS chosen, COUNT(*) AS count
       FROM events
       WHERE type = 'tap' AND correct = 0 AND choice IS NOT NULL
             AND (pretest IS NULL OR pretest = 0)
       GROUP BY ayah, position, choice
       ORDER BY count DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<{ ayah: number; position: number; chosen: string; count: number }>();
  return rows.results;
}

// ---- 7. D30 retention vs predicted (time-gated) ----
export async function d30Retention(db: D1Database): Promise<MetricResult> {
  const row = await db
    .prepare(`SELECT MIN(ts) AS first_ts, COUNT(*) AS n FROM events`)
    .first<{ first_ts: number | null; n: number }>();
  const firstTs = row?.first_ts ?? null;
  let note = "accrues once cards reach 30 days + retention probes run";
  if (firstTs) {
    const availableAt = new Date(firstTs + 30 * DAY_MS).toISOString().slice(0, 10);
    note = `accrues from ${availableAt} (30 days after first activity)`;
  }
  return {
    key: "d30",
    label: "D30 retention vs predicted",
    value: null,
    target: "FSRS calibration within ±10%",
    n: 0,
    note,
  };
}

/** All §3 metrics, in PRD table order. */
export async function allMetrics(db: D1Database): Promise<MetricResult[]> {
  return [
    await gatePassRate(db),
    await anchorAdherence(db),
    await cyclesToCleanPass(db),
    await lookAlikeSlipRate(db),
    await d30Retention(db),
    await interruptionCompletion(db),
    await timePerWord(db),
  ];
}
