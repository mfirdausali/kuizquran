// v2 Phase 1 (v2-D05, v2-D23) — the core drill vertical slice: tap-to-reconstruct
// against real corpus data, emitting real recall events (invariant #2: every tap
// commits to the append-only log BEFORE any UI feedback). No session/queue logic
// here yet (assembleQueue lands in Phase 2) — this screen drills one ayah at a
// time, picked by the learner via prev/next.
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Corpus, ReconstructState, Rung } from "engine";
import {
  advanceReconstruct,
  atomKey,
  bandOf,
  initReconstruct,
  makeEvent,
  nextReconstructItem,
} from "engine";
import { loadCorpus } from "../corpus/loadCorpus.ts";
import { append } from "../db/eventLog.ts";
import { rebuildAtoms } from "../db/atoms.ts";

const SURAH = 12; // v2 ships Yusuf only (v2-D29); the loader itself takes surah as a param.

interface Completion {
  full: boolean;
  before: number;
  after: number;
}

/** Fisher-Yates. Display-order shuffle only — the engine's option set is stable
 *  and deterministic (v2-D23/Appendix A: "the UI shuffles display order only"). */
function shuffled(items: string[]): string[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function Drill() {
  const [params, setParams] = useSearchParams();
  const ayah = Number(params.get("ayah") ?? "1");

  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rc, setRc] = useState<ReconstructState | null>(null);
  const [feedback, setFeedback] = useState<{ tile: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [strengthBefore, setStrengthBefore] = useState(0);

  useEffect(() => {
    loadCorpus(SURAH)
      .then(setCorpus)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  // (Re)start a pass over `ayah` once the corpus is loaded or the ayah changes.
  useEffect(() => {
    if (!corpus) return;
    let cancelled = false;
    setCompletion(null);
    setFeedback(null);
    rebuildAtoms().then((atoms) => {
      if (cancelled) return;
      const strength = atoms.get(atomKey("ayah", ayah))?.strength ?? 0;
      setStrengthBefore(strength);
      setRc(initReconstruct(corpus, SURAH, ayah, strength));
    });
    return () => {
      cancelled = true;
    };
  }, [corpus, ayah]);

  const item = useMemo(() => {
    if (!corpus || !rc) return null;
    const next = nextReconstructItem(rc, corpus);
    return "done" in next ? null : next;
  }, [corpus, rc]);

  const tiles = useMemo(() => (item ? shuffled(item.options) : []), [item]);

  async function handleTap(tile: string) {
    if (!corpus || !rc || !item || busy) return;
    setBusy(true);
    const correct = tile === item.correct;
    const rung: Rung = item.full ? "S3" : "S2";
    // Invariant #2: commit to the append-only log BEFORE any UI feedback.
    await append(
      makeEvent({
        type: "reconstruct_tap",
        ts: Date.now(),
        surah: SURAH,
        ayah,
        rung,
        position: item.currentBlank,
        choice: tile,
        correct,
        structured: true,
      }),
    );
    setFeedback({ tile, ok: correct });

    if (!correct) {
      setTimeout(() => {
        setFeedback(null);
        setBusy(false);
      }, 450);
      return;
    }

    const adv = advanceReconstruct(rc, corpus, tile);
    if (adv.ayahProduced) {
      const gradeRung: Rung = adv.full ? "S3" : "S2";
      await append(
        makeEvent({ type: "ayah_produced", ts: Date.now(), surah: SURAH, ayah, rung: gradeRung, structured: true }),
      );
      const atoms = await rebuildAtoms();
      const after = atoms.get(atomKey("ayah", ayah))?.strength ?? 0;
      setTimeout(() => {
        setFeedback(null);
        setRc(adv.state);
        setCompletion({ full: adv.full!, before: strengthBefore, after });
        setBusy(false);
      }, 450);
      return;
    }

    setTimeout(() => {
      setFeedback(null);
      setRc(adv.state);
      setBusy(false);
    }, 350);
  }

  function goTo(nextAyah: number) {
    if (!corpus) return;
    const bounded = Math.min(Math.max(1, nextAyah), corpus.meta.ayahCount);
    setParams({ ayah: String(bounded) });
  }

  if (error) {
    return (
      <div className="screen">
        <div className="banner banner--warn">
          <p>Corpus failed to load: {error}</p>
        </div>
      </div>
    );
  }

  if (!corpus || !rc) {
    return (
      <div className="screen">
        <p className="voice">Loading…</p>
      </div>
    );
  }

  const band = bandOf(strengthBefore);

  return (
    <div className="screen">
      <div className="card">
        <div className="card-header">
          <span>
            Surah {SURAH}:{ayah} · reconstruct · {band}
          </span>
          {item && (
            <span>
              blank {item.index} / {item.total}
            </span>
          )}
        </div>

        <div className="ayah">
          {rc.words.map((w, i) => {
            const blankIdx = rc.blankPositions.indexOf(w.position);
            if (blankIdx === -1) {
              return <span key={w.position}>{w.text_uthmani}{i < rc.words.length - 1 ? " " : ""}</span>;
            }
            const filled = blankIdx < rc.blankIndex;
            const isCurrent = item?.currentBlank === w.position;
            const cls = ["gap-slot", filled ? "is-filled" : "", isCurrent ? "is-current" : ""]
              .filter(Boolean)
              .join(" ");
            return (
              <span key={w.position} className={cls}>
                {filled ? w.text_uthmani : "   "}
                {i < rc.words.length - 1 ? " " : ""}
              </span>
            );
          })}
        </div>

        {completion ? (
          <div className="banner banner--ok">
            <p>
              {completion.full ? "Whole ayah produced." : "Reconstruction complete."} Strength{" "}
              {Math.round(completion.before)} → {Math.round(completion.after)}.
            </p>
            <p className="sub">reconstruct_tap + ayah_produced logged to the append-only event log.</p>
          </div>
        ) : (
          item && (
            <div className="bank">
              {tiles.map((tile) => {
                const isFeedback = feedback?.tile === tile;
                const cls = ["tile", isFeedback ? (feedback!.ok ? "is-ok" : "is-err") : ""]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button key={tile} className={cls} disabled={busy} onClick={() => handleTap(tile)}>
                    {tile}
                  </button>
                );
              })}
            </div>
          )
        )}

        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn" onClick={() => goTo(ayah - 1)} disabled={ayah <= 1}>
            ← Prev ayah
          </button>
          <button className="btn" onClick={() => goTo(ayah + 1)} disabled={ayah >= corpus.meta.ayahCount}>
            Next ayah →
          </button>
        </div>
        <p>
          <Link className="btn btn--ghost" to="/">
            ← Home
          </Link>
        </p>
      </div>
    </div>
  );
}
