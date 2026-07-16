// ROADMAP Phase 4 — the Test feature (v2-D13–D16): a self-initiated, read-only
// mirror over a learner-chosen range. Mixed random questions (vocab, cloze,
// junction, locate-the-ayah, chaining-reorder, produce-from-cold — the exact
// list in v2-D13) built by engine/src/test.ts's generators, which reuse the
// SAME generators the Learn ladder already uses (invariant #6). Purple accent
// (v2-D16), distinct from the teal Learn/Reinforce/Carry loop. Every answer
// commits to the append-only log BEFORE feedback (invariant #2) via
// `test_answer`; `test_result` never moves strength or due-dates (v2-D14) —
// rebuild.ts has no branch for any test_* event, by construction.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ayahWords,
  carriedAyat,
  clozeItem,
  isCorrectChoice,
  isCorrectLocate,
  isCorrectReorder,
  junctionTestItem,
  locateItem,
  produceItem,
  reorderItem,
  vocabItem,
  makeEvent,
  initReconstruct,
  advanceReconstruct,
  nextReconstructItem,
  type AtomsMap,
  type Corpus,
  type ReconstructState,
  type TestItem,
  type TestItemKind,
  type TestJunctionItem,
  type TestClozeItem,
  type TestVocabItem,
  type TestReorderItem,
  type TestProduceItem,
} from "engine";
import { loadCorpus } from "../corpus/loadCorpus.ts";
import { append } from "../db/eventLog.ts";
import { rebuildAtoms } from "../db/atoms.ts";

const SURAH = 12;
const ITEM_COUNT = 6;
const KIND_ORDER: TestItemKind[] = ["vocab", "cloze", "junction", "locate", "produce"];

function shuffledArr<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function buildItems(corpus: Corpus, pool: number[]): TestItem[] {
  if (pool.length === 0) return [];
  const order = shuffledArr(pool);
  const count = Math.min(ITEM_COUNT, order.length);
  const items: TestItem[] = [];
  for (let i = 0; i < count; i++) {
    const ayah = order[i]!;
    const kind = KIND_ORDER[i % KIND_ORDER.length]!;
    if (kind === "junction" && ayah + 1 > corpus.meta.ayahCount) {
      items.push(clozeItem(corpus, ayah));
      continue;
    }
    switch (kind) {
      case "vocab":
        items.push(vocabItem(corpus, SURAH, ayah));
        break;
      case "cloze":
        items.push(clozeItem(corpus, ayah));
        break;
      case "junction":
        items.push(junctionTestItem(corpus, ayah));
        break;
      case "locate":
        items.push(locateItem(corpus, ayah, pool));
        break;
      case "produce":
        items.push(produceItem(ayah));
        break;
    }
  }
  // v2-D13 explicitly names chaining-reorder — always include one when the
  // range spans at least 2 consecutive ayat.
  const reorderFrom = Math.min(...pool);
  const reorderCount = Math.min(3, corpus.meta.ayahCount - reorderFrom + 1);
  if (reorderCount >= 2) items.push(reorderItem(reorderFrom, reorderCount));

  return shuffledArr(items);
}

function itemAyah(item: TestItem): number {
  if (item.kind === "junction") return item.from;
  if (item.kind === "reorder") return item.ayahs[0]!;
  return item.ayah;
}

function ayahSnippet(corpus: Corpus, ayah: number, n = 4): string {
  return ayahWords(corpus, ayah)
    .slice(0, n)
    .map((w) => w.text_uthmani)
    .join(" ");
}

type Phase = "range" | "running" | "result";

export function Test() {
  const navigate = useNavigate();
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [atoms, setAtoms] = useState<AtomsMap | null>(null);
  const [phase, setPhase] = useState<Phase>("range");
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);

  const [items, setItems] = useState<TestItem[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ key: string; ok: boolean } | null>(null);
  const [reorderAttempt, setReorderAttempt] = useState<number[]>([]);
  const [reorderDisplay, setReorderDisplay] = useState<number[]>([]);
  const [rc, setRc] = useState<ReconstructState | null>(null);
  const produceSlipped = useRef(false);

  useEffect(() => {
    loadCorpus(SURAH).then(setCorpus).catch(() => setCorpus(null));
    void rebuildAtoms().then(setAtoms);
  }, []);

  const defaultPool = useMemo(() => (atoms ? carriedAyat([...atoms.values()], Date.now()) : []), [atoms]);

  useEffect(() => {
    if (from === null && to === null && corpus) {
      if (defaultPool.length > 0) {
        setFrom(defaultPool[0]!);
        setTo(defaultPool[defaultPool.length - 1]!);
      } else {
        setFrom(1);
        setTo(Math.min(10, corpus.meta.ayahCount));
      }
    }
  }, [defaultPool, from, to, corpus]);

  const current = items[index] ?? null;

  // (Re)init a nested reconstruct pass whenever the current item is "produce".
  useEffect(() => {
    if (!corpus || !current || current.kind !== "produce") {
      setRc(null);
      return;
    }
    produceSlipped.current = false;
    setRc(initReconstruct(corpus, SURAH, current.ayah, 0, { full: true }));
  }, [corpus, current]);

  useEffect(() => {
    if (current?.kind === "reorder") setReorderDisplay(shuffledArr(current.ayahs));
  }, [current]);

  // Display-order shuffles, computed ONCE per item (keyed on the stable `current`
  // object identity) — never inline in JSX, or a feedback-flash re-render would
  // reshuffle the tiles mid-interaction (v2-D23/Appendix A §E: the engine's
  // option SET is stable; only display order is randomized, and only once).
  const mcqDisplay = useMemo(() => {
    if (current && (current.kind === "vocab" || current.kind === "cloze" || current.kind === "junction")) {
      return shuffledArr(current.options);
    }
    return [];
  }, [current]);
  const locateDisplay = useMemo(() => (current?.kind === "locate" ? shuffledArr(current.options) : []), [current]);
  const produceCurrent = useMemo(() => {
    if (!corpus || !rc) return null;
    const it = nextReconstructItem(rc, corpus);
    return "done" in it ? null : { item: it, display: shuffledArr(it.options) };
  }, [corpus, rc]);

  useEffect(() => {
    if (phase === "running" && items.length > 0 && results.length === items.length) {
      const correct = results.filter(Boolean).length;
      setScore({ correct, total: items.length });
      setPhase("result");
    }
  }, [results, items, phase]);

  function startTest() {
    if (!corpus || from === null || to === null) return;
    const pool: number[] = [];
    for (let a = Math.min(from, to); a <= Math.max(from, to); a++) pool.push(a);
    const built = buildItems(corpus, pool);
    setItems(built);
    setIndex(0);
    setResults([]);
    setReorderAttempt([]);
    void append(makeEvent({ type: "test_start", ts: Date.now(), surah: SURAH, ayah: pool[0]!, to: pool[pool.length - 1]!, rung: "S1", structured: false }));
    setPhase("running");
  }

  function advance(correct: boolean) {
    setBusy(false);
    setResults((r) => [...r, correct]);
    setReorderAttempt([]);
    setIndex((i) => i + 1);
  }

  async function recordAnswer(item: TestItem, correct: boolean, choice: string) {
    await append(
      makeEvent({ type: "test_answer", ts: Date.now(), surah: SURAH, ayah: itemAyah(item), rung: "S1", testKind: item.kind, choice, correct, structured: false }),
    );
  }

  async function handleMcqChoice(item: TestVocabItem | TestClozeItem | TestJunctionItem, choice: string) {
    if (busy) return;
    setBusy(true);
    const correct = isCorrectChoice(item, choice);
    await recordAnswer(item, correct, choice);
    setFeedback({ key: choice, ok: correct });
    setTimeout(() => {
      setFeedback(null);
      advance(correct);
    }, 450);
  }

  async function handleLocateChoice(item: Extract<TestItem, { kind: "locate" }>, choice: number) {
    if (busy) return;
    setBusy(true);
    const correct = isCorrectLocate(item, choice);
    await recordAnswer(item, correct, String(choice));
    setFeedback({ key: String(choice), ok: correct });
    setTimeout(() => {
      setFeedback(null);
      advance(correct);
    }, 450);
  }

  async function handleReorderTap(item: TestReorderItem, ayah: number) {
    if (busy || reorderAttempt.includes(ayah)) return;
    const next = [...reorderAttempt, ayah];
    setReorderAttempt(next);
    if (next.length < item.ayahs.length) return;
    setBusy(true);
    const correct = isCorrectReorder(item, next);
    await recordAnswer(item, correct, next.join(","));
    setFeedback({ key: "reorder", ok: correct });
    setTimeout(() => {
      setFeedback(null);
      advance(correct);
    }, 450);
  }

  async function handleProduceTap(item: TestProduceItem, tile: string) {
    if (!corpus || !rc || busy) return;
    const rItem = nextReconstructItem(rc, corpus);
    if ("done" in rItem) return;
    setBusy(true);
    const correct = tile === rItem.correct;
    if (!correct) produceSlipped.current = true;
    setFeedback({ key: tile, ok: correct });
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
    const passCorrect = !produceSlipped.current;
    await recordAnswer(item, passCorrect, "produced");
    setTimeout(() => {
      setFeedback(null);
      setRc(adv.state);
      advance(passCorrect);
    }, 450);
  }

  async function finishSession(sendToReviews: boolean) {
    if (from === null || to === null || !score) return;
    await append(
      makeEvent({
        type: "test_result",
        ts: Date.now(),
        surah: SURAH,
        ayah: from,
        to,
        rung: "S1",
        score: score.correct / score.total,
        total: score.total,
        structured: false,
        sentToReviews: sendToReviews,
      }),
    );
    navigate("/progress");
  }

  if (!corpus) {
    return (
      <div className="screen">
        <p className="voice">Loading…</p>
      </div>
    );
  }

  if (phase === "range") {
    return (
      <div className="screen">
        <div className="card card--purple">
          <div className="card-header">
            <span>Test</span>
            <span>self-check</span>
          </div>
          <p className="voice">A mixed quiz over a range you choose — it never moves your progress.</p>
          {defaultPool.length === 0 && <p className="caption">Nothing carried yet — pick any range to test recognition.</p>}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label className="caption">
              From{" "}
              <input
                type="number"
                min={1}
                max={corpus.meta.ayahCount}
                value={from ?? 1}
                onChange={(e) => setFrom(Number(e.target.value))}
                style={{ width: 56 }}
              />
            </label>
            <label className="caption">
              To{" "}
              <input
                type="number"
                min={1}
                max={corpus.meta.ayahCount}
                value={to ?? corpus.meta.ayahCount}
                onChange={(e) => setTo(Number(e.target.value))}
                style={{ width: 56 }}
              />
            </label>
          </div>
          <button className="btn btn--purple" onClick={startTest}>
            Start Test
          </button>
          <Link className="btn btn--ghost" to="/">
            ← Home
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "result" && score) {
    const pct = Math.round((score.correct / score.total) * 100);
    return (
      <div className="screen">
        <div className="card card--purple">
          <div className="card-header">
            <span>Test result</span>
            <span>
              12:{from}–{to}
            </span>
          </div>
          <div className="banner banner--ok">
            <p>
              {score.correct} / {score.total} correct ({pct}%)
            </p>
            <p className="sub">test_result logged — no strength or due-dates moved.</p>
          </div>
          {score.correct < score.total && (
            <button className="btn btn--purple" onClick={() => void finishSession(true)}>
              Send weak ayat to reviews
            </button>
          )}
          <button className="btn btn--primary" onClick={() => void finishSession(false)}>
            Done
          </button>
        </div>
      </div>
    );
  }

  // running
  if (!current) {
    return (
      <div className="screen">
        <p className="voice">Loading…</p>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="card card--purple">
        <div className="card-header">
          <span>Test · {current.kind}</span>
          <span>
            {index + 1} / {items.length}
          </span>
        </div>

        {current.kind === "vocab" && (
          <>
            <div className="ayah">
              {current.ayahWords.map((w, i) => (
                <span key={w.position} style={w.position === current.position ? { color: "var(--purple-600)" } : { color: "var(--text-muted)" }}>
                  {w.text_uthmani}
                  {i < current.ayahWords.length - 1 ? " " : ""}
                </span>
              ))}
            </div>
            {mcqDisplay.map((o) => (
              <button
                key={o}
                className={"option" + (feedback?.key === o ? (feedback.ok ? " is-ok" : " is-err") : "")}
                disabled={busy}
                onClick={() => void handleMcqChoice(current, o)}
              >
                {o}
              </button>
            ))}
          </>
        )}

        {current.kind === "cloze" && (
          <>
            <div className="ayah">
              {current.ayahWords.map((w, i) => (
                <span key={w.position} className={w.position === current.blankPosition ? "gap-slot is-current" : ""}>
                  {w.position === current.blankPosition ? "   " : w.text_uthmani}
                  {i < current.ayahWords.length - 1 ? " " : ""}
                </span>
              ))}
            </div>
            <div className="bank">
              {mcqDisplay.map((o) => (
                <button
                  key={o}
                  className={"tile" + (feedback?.key === o ? (feedback.ok ? " is-ok" : " is-err") : "")}
                  disabled={busy}
                  onClick={() => void handleMcqChoice(current, o)}
                >
                  {o}
                </button>
              ))}
            </div>
          </>
        )}

        {current.kind === "junction" && (
          <>
            <p className="voice">Which ayah opens next, after 12:{current.from}?</p>
            {mcqDisplay.map((o) => (
              <button
                key={o}
                className={"option option--arabic" + (feedback?.key === o ? (feedback.ok ? " is-ok" : " is-err") : "")}
                disabled={busy}
                onClick={() => void handleMcqChoice(current, o)}
              >
                {o}
              </button>
            ))}
          </>
        )}

        {current.kind === "locate" && (
          <>
            <div className="ayah ayah--display">
              {current.ayahWords.map((w) => w.text_uthmani).join(" ")}
            </div>
            <p className="voice">Which ayah is this?</p>
            <div style={{ display: "flex", gap: 8 }}>
              {locateDisplay.map((o) => (
                <button
                  key={o}
                  className={"option" + (feedback?.key === String(o) ? (feedback.ok ? " is-ok" : " is-err") : "")}
                  disabled={busy}
                  onClick={() => void handleLocateChoice(current, o)}
                >
                  12:{o}
                </button>
              ))}
            </div>
          </>
        )}

        {current.kind === "reorder" && (
          <>
            <p className="voice">Tap the ayat back into reading order.</p>
            {reorderAttempt.length > 0 && (
              <p className="caption">Order so far: {reorderAttempt.map((a) => `12:${a}`).join(" → ")}</p>
            )}
            <div className="bank">
              {reorderDisplay.map((a) => (
                <button
                  key={a}
                  className={"tile" + (reorderAttempt.includes(a) ? " is-used" : "")}
                  disabled={busy || reorderAttempt.includes(a)}
                  onClick={() => void handleReorderTap(current, a)}
                >
                  {ayahSnippet(corpus, a)}
                </button>
              ))}
            </div>
          </>
        )}

        {current.kind === "produce" && rc && (
          <>
            <p className="voice">Produce the whole ayah, cold — no warm-up.</p>
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
                return (
                  <span key={w.position} className={"gap-slot" + (filled ? " is-filled" : " is-current")}>
                    {filled ? w.text_uthmani : "   "}
                    {i < rc.words.length - 1 ? " " : ""}
                  </span>
                );
              })}
            </div>
            {produceCurrent && (
              <div className="bank">
                {produceCurrent.display.map((o) => (
                  <button
                    key={o}
                    className={"tile" + (feedback?.key === o ? (feedback.ok ? " is-ok" : " is-err") : "")}
                    disabled={busy}
                    onClick={() => void handleProduceTap(current as TestProduceItem, o)}
                  >
                    {o}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <Link className="btn btn--ghost" to="/">
          ← Home
        </Link>
      </div>
    </div>
  );
}
