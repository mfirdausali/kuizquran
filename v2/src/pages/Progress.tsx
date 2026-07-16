// ROADMAP Phase 4 — the learner-facing Progress Report (v2-D17: "your Yūsuf",
// strictly separate from the operator admin console, which doesn't exist yet).
// Growth curve + streak calendar + Test history + export, computed from the
// SAME event stream every other surface reads (v2-D18) — no separate analytics
// system. Ring + flat grid (v2-D24/D25) are two zoom levels of one map.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ayahHeatmap,
  growthCurve,
  computeStreak,
  completedDayIndices,
  testHistory,
  halfLifeDays,
  atomKey,
  learningDayIndex,
  DEFAULT_DAY_CONFIG,
  type AtomsMap,
  type Corpus,
  type DrillEvent,
  type HeatmapRow,
} from "engine";
import { loadCorpus } from "../corpus/loadCorpus.ts";
import { rebuildAtoms } from "../db/atoms.ts";
import { getAll } from "../db/eventLog.ts";
import { movementsFor } from "../progress/movements.ts";
import { Ring } from "../progress/Ring.tsx";
import { Grid } from "../progress/Grid.tsx";
import { InfoTip } from "../components/InfoTip.tsx";

const SURAH = 12;
const CALENDAR_DAYS = 14;

function exportEvents(events: DrillEvent[]) {
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `iman-yusuf-events-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Progress() {
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [atoms, setAtoms] = useState<AtomsMap | null>(null);
  const [events, setEvents] = useState<DrillEvent[]>([]);
  const [selectedMovement, setSelectedMovement] = useState<number | null>(null);

  useEffect(() => {
    loadCorpus(SURAH).then(setCorpus).catch(() => setCorpus(null));
    void Promise.all([rebuildAtoms(), getAll()]).then(([a, e]) => {
      setAtoms(a);
      setEvents(e as DrillEvent[]);
    });
  }, []);

  const now = Date.now();
  const rows: HeatmapRow[] = useMemo(
    () => (corpus && atoms ? ayahHeatmap(corpus, atoms, now) : []),
    [corpus, atoms, now],
  );
  const movements = movementsFor(SURAH);
  const growth = useMemo(() => growthCurve(events), [events]);
  const streak = useMemo(() => computeStreak(completedDayIndices(events), now, DEFAULT_DAY_CONFIG), [events, now]);
  const history = useMemo(() => testHistory(events), [events]);

  const avgHalfLife = useMemo(() => {
    if (!atoms) return 0;
    const encoded = rows.filter((r) => r.encoded);
    if (encoded.length === 0) return 0;
    const sum = encoded.reduce((s, r) => s + halfLifeDays(atoms.get(atomKey("ayah", r.ayah))!), 0);
    return Math.round((sum / encoded.length) * 10) / 10;
  }, [atoms, rows]);

  const today = learningDayIndex(now, DEFAULT_DAY_CONFIG);
  const activeSet = useMemo(() => new Set(completedDayIndices(events)), [events]);
  const calendar = Array.from({ length: CALENDAR_DAYS }, (_, i) => today - (CALENDAR_DAYS - 1 - i));

  const maxCumulative = growth.length > 0 ? growth[growth.length - 1]!.cumulativeEncoded : 0;

  if (!corpus || !atoms) {
    return (
      <div className="screen">
        <p className="voice">Loading…</p>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="card">
        <div className="card-header">
          <span>Your Yūsuf</span>
          <span>{rows.filter((r) => r.encoded).length} / {corpus.meta.ayahCount} carried</span>
        </div>
        <p className="voice">Every number here comes straight from what you've actually recalled.</p>

        {movements && (
          <>
            <Ring movements={movements} rows={rows} selected={selectedMovement} onSelect={setSelectedMovement} />
            <p className="caption">Tap a movement to see its ayat below.</p>
          </>
        )}
        <Grid surah={SURAH} rows={rows} selectedMovement={selectedMovement} />

        <div className="card-header">
          <span>Growth</span>
          <span>{maxCumulative} encoded</span>
        </div>
        {growth.length === 0 ? (
          <p className="caption">No ayat encoded yet — your first Learn will start this curve.</p>
        ) : (
          <div className="growth-curve">
            {growth.map((p) => (
              <div key={p.day} style={{ height: `${Math.max(4, (p.cumulativeEncoded / Math.max(1, maxCumulative)) * 60)}px` }} />
            ))}
          </div>
        )}

        <div className="card-header">
          <span>Streak</span>
          <span>{streak.length} day{streak.length === 1 ? "" : "s"}</span>
        </div>
        <div className="streak-calendar">
          {calendar.map((d) => (
            <div key={d} className={"streak-day" + (activeSet.has(d) ? " is-active" : "")} />
          ))}
        </div>
        {streak.pausedOnMiss && <p className="caption">A day was missed — it's paused, not lost.</p>}

        <div className="card-header">
          <span>
            Average half-life <InfoTip label="i">How long a verse stays in your memory before you'd forget half of it without review. Longer is better.</InfoTip>
          </span>
          <span>{avgHalfLife} days</span>
        </div>

        <div className="card-header">
          <span>Test history</span>
        </div>
        {history.length === 0 ? (
          <p className="caption">No Tests taken yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {history
              .slice()
              .reverse()
              .map((h) => (
                <div key={h.ts} className="banner" style={{ background: "var(--purple-100)", color: "var(--purple-800)" }}>
                  <p>
                    12:{h.from}–{h.to} · {Math.round((h.score / h.total) * 100)}% ({h.score}/{h.total})
                  </p>
                  <p className="sub">{new Date(h.ts).toLocaleDateString()}{h.sentToReviews ? " · sent to reviews" : ""}</p>
                </div>
              ))}
          </div>
        )}

        <button className="btn" onClick={() => exportEvents(events)}>
          Export my data
        </button>
        <p>
          <Link className="btn btn--purple" to="/test">
            Take a Test →
          </Link>
        </p>
        <p>
          <Link className="btn btn--ghost" to="/">
            ← Home
          </Link>
        </p>
      </div>
    </div>
  );
}
