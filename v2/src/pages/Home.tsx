// Phase 0 shell (v2-ROADMAP Phase 0): no drill mechanics yet — just proof that
// the reused science is wired: corpus loads (surah-keyed, v2-D29), an event
// commits to the append-only log, and atoms rebuild from it (invariant #2).
// The real Home surface (assembleQueue, pace modes) is rebuilt in Phase 2.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Corpus } from "engine";
import { makeEvent } from "engine";
import { loadCorpus } from "../corpus/loadCorpus.ts";
import { append } from "../db/eventLog.ts";
import { rebuildAtoms } from "../db/atoms.ts";

const SURAH = 12; // v2 ships Yusuf only (v2-D29); the loader itself takes surah as a param.

export function Home() {
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [atomCount, setAtomCount] = useState<number | null>(null);

  useEffect(() => {
    loadCorpus(SURAH)
      .then(setCorpus)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  async function smokeTest() {
    // Append one event, then rebuild atoms from the durable log — proves the
    // ported event layer works end to end from the UI, not just in tests.
    await append(makeEvent({ type: "rung_complete", ts: Date.now(), surah: SURAH, ayah: 1, rung: "S1" }));
    const atoms = await rebuildAtoms();
    setAtomCount(atoms.size);
  }

  return (
    <div className="screen">
      <div className="card">
        <div className="card-header">
          <span>iman.app v2</span>
          <span>Phase 0 — scaffold</span>
        </div>
        {error && (
          <div className="banner banner--warn">
            <p>Corpus failed to load: {error}</p>
          </div>
        )}
        {!error && !corpus && <p className="voice">Loading corpus…</p>}
        {corpus && (
          <div className="banner banner--ok">
            <p>
              Surah {corpus.meta.surah} loaded — {corpus.meta.ayahCount} ayat, {corpus.meta.wordCount} words.
            </p>
            <p className="sub">Retention engine + append-only event log ported from v1, tests green.</p>
          </div>
        )}
        <button className="btn btn--primary" onClick={smokeTest}>
          Append event + rebuild atoms
        </button>
        {atomCount !== null && <p className="caption">Atoms cache rebuilt from the log: {atomCount} atom(s).</p>}
        <p>
          <Link className="btn btn--primary" to="/drill?ayah=1">
            Drill — tap to reconstruct →
          </Link>
        </p>
        <p>
          <Link className="btn btn--ghost" to="/system-explorer">
            System Explorer →
          </Link>
        </p>
      </div>
    </div>
  );
}
