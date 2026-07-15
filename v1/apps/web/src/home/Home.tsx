// Home base (personal progress dashboard + training selector). The screen the
// user LANDS on — status at a glance, then a selector to choose training. Pure
// ASSEMBLY of existing engine data; mutates nothing; consumes iman-ui.css verbatim
// (invariant #5). Honors invariant #1 (ayah is the unit — weak spots filtered to
// kind==="ayah"), no-guilt copy, quiet streak.

import { useMemo } from "react";
import {
  ayahHeatmap,
  weakSpots,
  planFor,
  floorQueue,
  atomKey,
  type AtomsMap,
  type Corpus,
  type QueueItem,
  type StreakState,
} from "engine";
import { AyahHero } from "../components/AyahHero.tsx";
import { DecayLine } from "../habit/DecayLine.tsx";
import { Streak } from "../habit/Streak.tsx";

export type TrainingView = "session" | "gym" | "open" | "floor" | "heatmap";

// Plain-language legend for the progress card, shown as a native title tooltip.
// Ties each word to what the user actually did / can do (no jargon, no guilt).
const NOMENCLATURE =
  "Begun — you've learned the ayah at least once.\n" +
  "Carried — you can recall it cold, days later; it's held firmly (the goal).\n" +
  "Strong — same as carried: an ayah in the top retention band.\n\n" +
  "New ayat start as begun and become carried over several days of short reviews as your memory of them firms up.";

export function Home({
  corpus,
  atoms,
  queue,
  current,
  streak,
  onSelect,
}: {
  corpus: Corpus;
  atoms: AtomsMap;
  queue: QueueItem[];
  current: QueueItem | null;
  streak: StreakState | null;
  onSelect: (view: TrainingView) => void;
}) {
  const now = Date.now();
  const atomList = useMemo(() => [...atoms.values()], [atoms]);

  const model = useMemo(() => {
    const rows = ayahHeatmap(corpus, atoms, now);
    const carried = rows.filter((r) => r.band === "carry").length;
    const encoded = rows.filter((r) => r.encoded).length;
    const strong = carried;
    const remaining = corpus.meta.ayahCount - encoded;
    const avgWords = Math.max(1, Math.round(corpus.meta.wordCount / corpus.meta.ayahCount));
    const plan = planFor({ remainingAyat: remaining, avgWordsPerAyah: avgWords, minutesPerDay: 8 });

    // Minutes left today = sum of the queue's own estimates (each item carries it).
    const minsLeft = Math.round(queue.reduce((s, q) => s + q.estMin, 0));

    // Fading: weakest ENCODED ayah atoms (invariant #1 — filter kind==="ayah").
    const weak = weakSpots(atomList, now, 8).filter((w) => w.kind === "ayah");
    const fading = weak.slice(0, 3).map((w) => {
      const atom = atoms.get(atomKey("ayah", w.ref))!;
      return { ref: w.ref, atom };
    });

    const floor = floorQueue(atomList, now);
    return { carried, encoded, strong, minsLeft, fading, weakCount: weak.length, floor };
  }, [corpus, atoms, atomList, queue, now]);

  const hasQueue = queue.length > 0;
  const heroVerse = current
    ? corpus.verses.find((v) => v.ayah === current.ayah)
    : undefined;

  return (
    <div className="screen">
      {/* ── Today ── */}
      <div className="card">
        <div className="card-header">
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            Today {streak && <Streak streak={streak} />}
          </span>
          <span>{hasQueue ? "ready" : "caught up"}</span>
        </div>
        {heroVerse && <AyahHero text={heroVerse.text_uthmani} display />}
        {hasQueue ? (
          <div className="banner banner--ok">
            <p>A short session is ready — about {Math.max(1, model.minsLeft)} min.</p>
          </div>
        ) : (
          <div className="banner">
            <p>Nothing due right now — free practice is always open.</p>
          </div>
        )}
      </div>

      {/* ── Your Yusuf (progress) ── */}
      <div className="card">
        <div className="card-header">
          <span>Your Yusuf</span>
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {model.carried} / 111 carried
            <span
              className="caption"
              style={{ cursor: "help", userSelect: "none" }}
              tabIndex={0}
              aria-label={NOMENCLATURE}
              title={NOMENCLATURE}
            >
              ⓘ
            </span>
          </span>
        </div>
        <div className="meter">
          <div style={{ width: `${Math.round((model.carried / corpus.meta.ayahCount) * 100)}%` }} />
        </div>
        <p className="caption">
          {model.encoded} of 111 begun · {model.carried} strong ·
          {model.encoded < corpus.meta.ayahCount ? ` ~${planFor({ remainingAyat: corpus.meta.ayahCount - model.encoded, avgWordsPerAyah: 16, minutesPerDay: 8 }).etaDays} days at this pace` : " complete"}
        </p>
      </div>

      {/* ── Fading (decay-visible) ── hidden if nothing encoded ── */}
      {model.fading.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span>Fading</span>
            <span>{model.weakCount} to firm up</span>
          </div>
          {model.fading.map(({ ref, atom }) => (
            <button
              key={ref}
              className="btn btn--ghost"
              style={{ textAlign: "left", padding: "4px 6px" }}
              onClick={() => onSelect("gym")}
            >
              <span className="caption">12:{ref} </span>
              <DecayLine atom={atom} since={atom.lastRetrieval ?? now} now={now} />
            </button>
          ))}
        </div>
      )}

      {/* ── Where to next? (the selector) ── */}
      <div className="card">
        <div className="card-header">
          <span>Where to next?</span>
        </div>

        {/* Continue today — primary when there's a queue */}
        <button
          className={hasQueue ? "btn btn--primary" : "btn"}
          disabled={!hasQueue}
          onClick={() => onSelect("session")}
        >
          {hasQueue
            ? `Continue today — ~${Math.max(1, model.minsLeft)} min`
            : "Today's session — complete, back tomorrow"}
        </button>

        {/* Weak-spot gym */}
        <button className="btn" disabled={model.weakCount === 0} onClick={() => onSelect("gym")}>
          {model.weakCount > 0
            ? `Weak-spot gym — ${model.weakCount} soft spot${model.weakCount > 1 ? "s" : ""}`
            : "Weak-spot gym — nothing soft yet"}
        </button>

        {/* 2-minute floor — primary when no queue (promoted) */}
        <button
          className={hasQueue ? "btn" : "btn btn--primary"}
          onClick={() => onSelect("floor")}
        >
          Two minutes — {model.floor[0]?.kind === "gate" ? "a cold gate" : "a quick touch"}
        </button>

        {/* Open practice */}
        <button className="btn" onClick={() => onSelect("open")}>
          Open practice — any ayah, any drill
        </button>

        {/* Review the map */}
        <button className="btn" onClick={() => onSelect("heatmap")}>
          Review the map — {model.strong} strong of 111
        </button>
      </div>
    </div>
  );
}
