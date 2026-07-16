// ROADMAP Phase 2 — the day-1 COLD whole-bank gate check (invariant #9 / FR3): a
// forced full-ayah reconstruct pass with NO warm-up (opts.full on initReconstruct
// bypasses the strength-band blank count). One slip anywhere in the pass fails
// the whole gate — invariant #1, the graded unit is the whole ayah, no partial
// credit on a cold check.
//
// Gate forgiveness (v2-D08): after RESCAFFOLD_AFTER_FAILS consecutive fails, the
// learner gets a lighter S2 re-teach pass BEFORE the next cold attempt; after
// DEMOTE_OFFER_AFTER_FAILS, they're offered (never forced) "send this verse back
// to Learn" — re-learned, not abandoned.
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Corpus, GateForgiveness, ReconstructState, Rung } from "engine";
import {
  advanceReconstruct,
  atomKey,
  gateForgiveness,
  initAtom,
  initReconstruct,
  makeEvent,
  nextReconstructItem,
} from "engine";
import { loadCorpus } from "../corpus/loadCorpus.ts";
import { append } from "../db/eventLog.ts";
import { rebuildAtoms } from "../db/atoms.ts";

const SURAH = 12;

function shuffled(items: string[]): string[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

type Stage = "rescaffold" | "cold" | "demote-offer" | "demoted" | "pass" | "fail" | "not-learned";

export function Gate() {
  const [params] = useSearchParams();
  const ayah = Number(params.get("ayah") ?? "1");

  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rc, setRc] = useState<ReconstructState | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [slipped, setSlipped] = useState(false);
  const [feedback, setFeedback] = useState<{ tile: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadCorpus(SURAH)
      .then(setCorpus)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!corpus) return;
    let cancelled = false;
    rebuildAtoms().then((atoms) => {
      if (cancelled) return;
      const atom = atoms.get(atomKey("ayah", ayah)) ?? initAtom("ayah", ayah);
      // The queue only ever offers a gate item for an already-ENCODED atom with a
      // due gate; a direct visit to an un-taught ayah has nothing to cold-check.
      if (!atom.encoded) {
        setStage("not-learned");
        return;
      }
      const forgiveness: GateForgiveness = gateForgiveness(atom);
      if (forgiveness === "demote") {
        setStage("demote-offer");
        return;
      }
      setSlipped(false);
      setStage(forgiveness === "rescaffold" ? "rescaffold" : "cold");
      setRc(initReconstruct(corpus, SURAH, ayah, atom.strength, { full: forgiveness === "cold" }));
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
    if (stage !== "rescaffold" && stage !== "cold") return;
    setBusy(true);
    const correct = tile === item.correct;
    const rung: Rung = item.full ? "S3" : "S2";

    // Invariant #2: commit BEFORE any UI feedback, for both the warm-up and the
    // cold check — the cold check's per-tap taps are still evidence even though
    // the pass/fail verdict is decided once, at the end, by a single gate_result.
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
    if (stage === "cold" && !correct) setSlipped(true);
    setFeedback({ tile, ok: correct });

    if (!correct) {
      setTimeout(() => {
        setFeedback(null);
        setBusy(false);
      }, 450);
      return;
    }

    const adv = advanceReconstruct(rc, corpus, tile);
    if (!adv.ayahProduced) {
      setTimeout(() => {
        setFeedback(null);
        setRc(adv.state);
        setBusy(false);
      }, 350);
      return;
    }

    if (stage === "rescaffold") {
      const gradeRung: Rung = adv.full ? "S3" : "S2";
      await append(
        makeEvent({ type: "ayah_produced", ts: Date.now(), surah: SURAH, ayah, rung: gradeRung, structured: true }),
      );
      // Warm-up done — present the real cold check next.
      const atoms = await rebuildAtoms();
      const atom = atoms.get(atomKey("ayah", ayah)) ?? initAtom("ayah", ayah);
      setTimeout(() => {
        setFeedback(null);
        setSlipped(false);
        setStage("cold");
        setRc(initReconstruct(corpus, SURAH, ayah, atom.strength, { full: true }));
        setBusy(false);
      }, 450);
      return;
    }

    // Cold check finished: one pass, no partial credit — any slip fails the whole gate.
    const passed = !slipped;
    await append(
      makeEvent({ type: "gate_result", ts: Date.now(), surah: SURAH, ayah, rung: "S3", correct: passed, structured: true }),
    );
    setTimeout(() => {
      setFeedback(null);
      setStage(passed ? "pass" : "fail");
      setBusy(false);
    }, 450);
  }

  async function sendBackToLearn() {
    await append(makeEvent({ type: "gate_demote", ts: Date.now(), surah: SURAH, ayah, rung: "S3" }));
    setStage("demoted");
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

  if (!corpus || !stage) {
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
          <span>Surah {SURAH}:{ayah} · cold gate</span>
          {item && (
            <span>
              {stage === "rescaffold" ? "warm-up" : "cold check"} · {item.index} / {item.total}
            </span>
          )}
        </div>

        {stage === "not-learned" && (
          <>
            <div className="banner banner--warn">
              <p>This ayah hasn't been learned yet — nothing to cold-check.</p>
            </div>
            <Link className="btn btn--primary" to={`/drill?ayah=${ayah}`}>
              Learn it →
            </Link>
          </>
        )}

        {stage === "demote-offer" && (
          <>
            <div className="banner banner--warn">
              <p>This verse has failed its cold gate several times.</p>
              <p className="sub">You can send it back to Learn — it'll be re-taught, not abandoned.</p>
            </div>
            <button className="btn btn--primary" onClick={sendBackToLearn}>
              Send back to Learn
            </button>
            <Link className="btn btn--ghost" to={`/drill?ayah=${ayah}`}>
              Try the gate anyway →
            </Link>
          </>
        )}

        {stage === "demoted" && (
          <div className="banner banner--ok">
            <p>Sent back to Learn.</p>
            <p className="sub">gate_demote logged — it'll re-earn its encoding and a fresh gate.</p>
          </div>
        )}

        {(stage === "rescaffold" || stage === "cold") && rc && (
          <>
            {stage === "rescaffold" && (
              <p className="voice">A lighter warm-up first — then the real cold check.</p>
            )}
            <div className="ayah">
              {rc.words.map((w, i) => {
                const blankIdx = rc.blankPositions.indexOf(w.position);
                if (blankIdx === -1) {
                  return (
                    <span key={w.position}>
                      {w.text_uthmani}
                      {i < rc.words.length - 1 ? " " : ""}
                    </span>
                  );
                }
                const filled = blankIdx < rc.blankIndex;
                const isCurrent = item?.currentBlank === w.position;
                const cls = ["gap-slot", filled ? "is-filled" : "", isCurrent ? "is-current" : ""]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <span key={w.position} className={cls}>
                    {filled ? w.text_uthmani : "   "}
                    {i < rc.words.length - 1 ? " " : ""}
                  </span>
                );
              })}
            </div>

            {item && (
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
            )}
          </>
        )}

        {stage === "pass" && (
          <div className="banner banner--ok">
            <p>Gate passed — cold, no slips.</p>
          </div>
        )}
        {stage === "fail" && (
          <div className="banner banner--warn">
            <p>Gate not passed this time — it'll come due again tomorrow.</p>
          </div>
        )}

        <p>
          <Link className="btn btn--ghost" to="/">
            ← Home
          </Link>
        </p>
      </div>
    </div>
  );
}
