"use client";

// THE TEST FEATURE, WIRED — v2 Phase 4 (v2-D13..D16), v3-D103's own named
// deferral: `packages/engine/src/test.ts` (11 exported functions, unit-tested
// since the day the heatmap landed) had ZERO production callers anywhere in
// v3, because — unlike every other "mechanism built, never wired" finding
// this build has closed one at a time (v3-D89..D103) — this one genuinely
// needs a whole new route rather than a card on an existing one.
//
// ---------------------------------------------------------------------------
// WHAT THIS COMPONENT IS ALLOWED TO DECIDE
// ---------------------------------------------------------------------------
// Which (kind, ayah) pairs make today's mixed quiz, and in what order — the
// engine's own header for `test.ts` says that IS the UI's job here, unlike
// every graded surface where `check-boundaries.mjs` clause 5 forbids it.
// Everything else — whether a tap is correct, what options a kind gets, which
// ayat are "carried" — is a call into `test.ts`/`reconstruct.ts`, never
// re-derived here.
//
// ---------------------------------------------------------------------------
// READ-ONLY, BY CONSTRUCTION, NOT BY CONVENTION
// ---------------------------------------------------------------------------
// `rebuild.ts#applyEvent` has NO branch for test_start/test_answer/test_result
// — invariant #5. This component cannot accidentally move strength no matter
// what it does with these events, because the fold itself does not look at
// them. The one thing it must still get right is COMMIT BEFORE PAINT
// (invariant #2): every `test_answer`/`test_result` is appended and awaited
// before a verdict paints.
//
// A Test's "produce" item nests a full reconstruct pass, but UNLIKE the real
// session loop it never appends a `reconstruct_tap` per tap — only the whole
// pass's outcome becomes ONE `test_answer`. Logging raw taps here would mix
// Test's read-only evidence into the SAME ayah's real graded history, which is
// exactly what "read-only mirror" (v2-D14) forbids. `advanceReconstruct` is
// still the ONLY thing that decides a tap's correctness (never `===`), so this
// surface carries no second, unaudited copy of B6's fix.
//
// ---------------------------------------------------------------------------
// EVERY TAP IS FOLLOWED BY AN EXPLICIT "CONTINUE" — never a timed auto-advance
// ---------------------------------------------------------------------------
// Mirrors `SessionIsland`'s own `reveal`/`onContinue` discipline exactly,
// rather than v2's `setTimeout(450)`: a verdict paints, the learner
// acknowledges it, THEN the next question (or the next reconstruct blank)
// appears. This is both a UX and a testability property — nothing here
// depends on real-clock timing, so a test drives the whole flow with plain
// `fireEvent.click`.
//
// ---------------------------------------------------------------------------
// SEEDED DISPLAY, RANDOM SELECTION — two different kinds of "unpredictable"
// ---------------------------------------------------------------------------
// WHICH (kind, ayah) pairs make the Test is genuinely random (`test.ts`'s own
// header: "a Test's raison d'être is a real, unpredictable mixed quiz") — a
// real `shuffle` (Math.random-backed) is passed into `buildTestItems`, once,
// at "Start Test". But a rendered OPTION BANK'S display order must stay stable
// across re-renders (`lib/onboarding/pass.ts#displayOrder`'s own header), so
// every option/locate/reorder/produce display below uses that same seeded
// permutation, keyed on the current item's stable position — never
// Math.random.
//
// NO ARABIC IS WRITTEN HERE. Every surface string rendered below is read back
// out of a TestItem the engine already built; this file supplies none of its
// own.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { Corpus, DrillEvent, GlossLang } from "@engine/types.ts";
import { rebuild } from "@engine/rebuild.ts";
import { gradeClassToWire } from "@engine/gradeClass.ts";
import type { DisabledQuestion } from "@engine/overrides.ts";
import {
  advanceReconstruct,
  initReconstruct,
  nextReconstructItem,
  type ReconstructState,
} from "@engine/reconstruct.ts";
import {
  carriedAyat,
  isCorrectChoice,
  isCorrectLocate,
  isCorrectReorder,
  type TestItem,
} from "@engine/test.ts";

import { fetchEffectiveCorpus } from "@/lib/corpus/client";
import { append, currentTz } from "@/lib/idb/append";
import { getEventsForSurah } from "@/lib/idb/read";
import { writeLock } from "@/lib/idb/writeLock";
import { displayOrder } from "@/lib/onboarding/pass";
import { buildTestItems, itemAyah, ayahSnippet } from "@/lib/test/build";
import { optionStateClass } from "@/components/quiz/reveal";

export interface TestIslandProps {
  surah: number;
  glossLang: GlossLang;
}

type Phase =
  | { kind: "loading" }
  | { kind: "not-writer" }
  | { kind: "unavailable" }
  | { kind: "failed"; message: string }
  | { kind: "range" }
  | { kind: "running" }
  | { kind: "result" };

/** A real, unpredictable Fisher-Yates. Used ONCE, for item SELECTION, at
 *  "Start Test" — never for a rendered option's display order (see header). */
function randomShuffle<T>(items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** A stable permutation of `[0..n-1]` for the current item/blank — seeded so
 *  a re-render never reshuffles a bank under the learner's finger. */
function permute(n: number, seed: number): number[] {
  return displayOrder(n, seed);
}

interface Feedback {
  ok: boolean;
  /** Which DISPLAYED index was tapped, for `optionStateClass` — absent for a
   *  reorder item, which has no single "chosen tile". */
  chosenIndex?: number;
}

export function TestIsland({ surah, glossLang }: TestIslandProps) {
  const router = useRouter();
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  // The resolved active-disable list (v2-D21/D55). Held beside the corpus
  // because it is a decision ABOUT the corpus that the bytes cannot carry —
  // `buildTestItems` is the one consumer, and it takes it as a required
  // argument so this can never be silently dropped again.
  const [disabled, setDisabled] = useState<DisabledQuestion[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [defaultPool, setDefaultPool] = useState<number[]>([]);
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);

  const [items, setItems] = useState<TestItem[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [reorderAttempt, setReorderAttempt] = useState<number[]>([]);

  // Local, NEVER-APPENDED reconstruct state for a "produce" item — see the
  // header on why this never touches append() per tap.
  const [rc, setRc] = useState<ReconstructState | null>(null);
  const [rcFilled, setRcFilled] = useState<Map<number, string>>(new Map());
  const [rcSlipped, setRcSlipped] = useState(false);

  // What tapping "Continue" does next — set by whichever handler just showed
  // `feedback`, cleared once run. A ref (not state): it holds a closure, never
  // needs to trigger its own render, and reading it happens only from the
  // Continue button's own click handler.
  const pendingRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | null = null;

    async function beginAsWriter(): Promise<void> {
      try {
        const effective = await fetchEffectiveCorpus(surah);
        if (!alive) return;
        if (!effective) {
          setPhase({ kind: "unavailable" });
          return;
        }
        const c = effective.corpus;
        setCorpus(c);
        setDisabled(effective.disabled);
        const events = await getEventsForSurah(surah);
        if (!alive) return;
        const atoms = [...rebuild(events).values()];
        const pool = carriedAyat(atoms, Date.now());
        setDefaultPool(pool);
        if (pool.length > 0) {
          setFrom(pool[0]!);
          setTo(pool[pool.length - 1]!);
        } else {
          setFrom(1);
          setTo(Math.min(10, c.meta.ayahCount));
        }
        setPhase({ kind: "range" });
      } catch (err) {
        if (!alive) return;
        setPhase({
          kind: "failed",
          message: err instanceof Error ? err.message : "Could not load this Test.",
        });
      }
    }

    void (async () => {
      try {
        const status = await writeLock.acquire();
        if (!alive) return;
        if (status.role === "writer") {
          await beginAsWriter();
          return;
        }
        setPhase({ kind: "not-writer" });
        unsubscribe = writeLock.subscribe((s) => {
          if (!alive || s.role !== "writer") return;
          unsubscribe?.();
          unsubscribe = null;
          void beginAsWriter();
        });
      } catch (err) {
        if (!alive) return;
        setPhase({
          kind: "failed",
          message: err instanceof Error ? err.message : "Could not load this Test.",
        });
      }
    })();
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [surah]);

  const current = items[index] ?? null;

  // (Re)init the nested reconstruct pass whenever the current item is
  // "produce".
  useEffect(() => {
    if (!corpus || !current || current.kind !== "produce") {
      setRc(null);
      setRcFilled(new Map());
      setRcSlipped(false);
      return;
    }
    setRcSlipped(false);
    setRcFilled(new Map());
    setRc(initReconstruct(corpus, surah, current.ayah, 0, { full: true }));
  }, [corpus, surah, current]);

  useEffect(() => {
    setReorderAttempt([]);
    setFeedback(null);
    pendingRef.current = null;
  }, [current]);

  async function startTest() {
    if (!corpus || from === null || to === null) return;
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    const pool: number[] = [];
    for (let a = lo; a <= hi; a++) pool.push(a);
    const built = buildTestItems(corpus, surah, pool, glossLang, disabled, randomShuffle);
    setItems(built);
    setIndex(0);
    setResults([]);
    setRange({ from: pool[0]!, to: pool[pool.length - 1]! });
    try {
      const event: DrillEvent = {
        type: "test_start",
        ts: Date.now(),
        tz: currentTz(),
        surah,
        ayah: pool[0]!,
        to: pool[pool.length - 1]!,
        rung: gradeClassToWire("ungraded"),
        structured: false,
      };
      await append(event, { now: Date.now(), tz: currentTz() });
      setPhase({ kind: "running" });
    } catch (err) {
      setPhase({
        kind: "failed",
        message: err instanceof Error ? err.message : "Could not start this Test.",
      });
    }
  }

  const advanceItem = useCallback((correct: boolean) => {
    setResults((r) => [...r, correct]);
    setIndex((i) => i + 1);
  }, []);

  async function recordAnswer(item: TestItem, correct: boolean, choice: string): Promise<boolean> {
    try {
      const event: DrillEvent = {
        type: "test_answer",
        ts: Date.now(),
        tz: currentTz(),
        surah,
        ayah: itemAyah(item),
        rung: gradeClassToWire("ungraded"),
        testKind: item.kind,
        choice,
        correct,
        structured: false,
      };
      await append(event, { now: Date.now(), tz: currentTz() });
      return true;
    } catch (err) {
      setPhase({
        kind: "failed",
        message: err instanceof Error ? err.message : "That answer could not be saved.",
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleMcqTap(
    item: Extract<TestItem, { kind: "vocab" | "cloze" | "junction" }>,
    displayed: string[],
    displayIndex: number,
  ) {
    if (busy || feedback) return;
    setBusy(true);
    const choice = displayed[displayIndex]!;
    const correct = isCorrectChoice(item, choice);
    // COMMIT BEFORE PAINT: the verdict only paints once the append lands.
    const ok = await recordAnswer(item, correct, choice);
    if (!ok) return;
    setFeedback({ ok: correct, chosenIndex: displayIndex });
    pendingRef.current = () => advanceItem(correct);
  }

  async function handleLocateTap(
    item: Extract<TestItem, { kind: "locate" }>,
    displayed: number[],
    displayIndex: number,
  ) {
    if (busy || feedback) return;
    setBusy(true);
    const choice = displayed[displayIndex]!;
    const correct = isCorrectLocate(item, choice);
    const ok = await recordAnswer(item, correct, String(choice));
    if (!ok) return;
    setFeedback({ ok: correct, chosenIndex: displayIndex });
    pendingRef.current = () => advanceItem(correct);
  }

  async function handleReorderTap(item: Extract<TestItem, { kind: "reorder" }>, ayah: number) {
    if (busy || feedback || reorderAttempt.includes(ayah)) return;
    const next = [...reorderAttempt, ayah];
    setReorderAttempt(next);
    if (next.length < item.ayahs.length) return;
    setBusy(true);
    const correct = isCorrectReorder(item, next);
    const ok = await recordAnswer(item, correct, next.join(","));
    if (!ok) return;
    setFeedback({ ok: correct });
    pendingRef.current = () => advanceItem(correct);
  }

  async function handleProduceTap(item: Extract<TestItem, { kind: "produce" }>, tile: string) {
    if (!corpus || !rc || busy || feedback) return;
    const rItem = nextReconstructItem(rc, corpus);
    if ("done" in rItem) return;
    setBusy(true);
    const adv = advanceReconstruct(rc, corpus, tile);
    if (!adv.correct) {
      setRcSlipped(true);
      setFeedback({ ok: false });
      // Nothing is appended for a wrong intra-ayah tap (read-only mirror) —
      // Continue just clears the verdict and re-offers the SAME blank.
      pendingRef.current = () => {};
      setBusy(false);
      return;
    }
    setRcFilled((m) => {
      const next = new Map(m);
      next.set(rItem.currentBlank, tile);
      return next;
    });
    if (!adv.ayahProduced) {
      setFeedback({ ok: true });
      pendingRef.current = () => setRc(adv.state);
      setBusy(false);
      return;
    }
    // The whole ayah just completed — ONE test_answer for the whole pass,
    // never a per-tap event.
    const passCorrect = !rcSlipped;
    const ok = await recordAnswer(item, passCorrect, "produced");
    if (!ok) return;
    setFeedback({ ok: passCorrect });
    pendingRef.current = () => {
      setRc(adv.state);
      advanceItem(passCorrect);
    };
  }

  function onContinue() {
    const fn = pendingRef.current;
    pendingRef.current = null;
    setFeedback(null);
    fn?.();
  }

  async function finishTest(sentToReviews: boolean) {
    if (!range) return;
    const correct = results.filter(Boolean).length;
    try {
      const event: DrillEvent = {
        type: "test_result",
        ts: Date.now(),
        tz: currentTz(),
        surah,
        ayah: range.from,
        to: range.to,
        rung: gradeClassToWire("ungraded"),
        score: results.length > 0 ? correct / results.length : 0,
        total: results.length,
        structured: false,
        sentToReviews,
      };
      await append(event, { now: Date.now(), tz: currentTz() });
      router.push("/progress");
    } catch (err) {
      setPhase({
        kind: "failed",
        message: err instanceof Error ? err.message : "That result could not be saved.",
      });
    }
  }

  // Once every item is answered, move to the result phase.
  useEffect(() => {
    if (phase.kind === "running" && items.length > 0 && results.length === items.length) {
      setPhase({ kind: "result" });
    }
  }, [phase, items, results]);

  // Every generator in test.ts (mirroring ladder.ts/options.ts/chain.ts) hands
  // back `[correct, ...distractors]` — the correct answer always at RAW index
  // 0, with distractors filtered to never equal it. So the display-order
  // correct index is always `perm.indexOf(0)`; no string comparison needed.
  const mcqDisplay = useMemo(() => {
    if (!current || (current.kind !== "vocab" && current.kind !== "cloze" && current.kind !== "junction")) {
      return null;
    }
    const perm = permute(current.options.length, index);
    return { options: perm.map((i) => current.options[i]!), correctIndex: perm.indexOf(0) };
  }, [current, index]);

  const locateDisplay = useMemo(() => {
    if (!current || current.kind !== "locate") return null;
    const perm = permute(current.options.length, index);
    return { options: perm.map((i) => current.options[i]!), correctIndex: perm.indexOf(0) };
  }, [current, index]);

  const reorderDisplay = useMemo(() => {
    if (!current || current.kind !== "reorder") return null;
    const perm = permute(current.ayahs.length, index);
    return perm.map((i) => current.ayahs[i]!);
  }, [current, index]);

  const produceCurrent = useMemo(() => {
    if (!corpus || !rc) return null;
    const it = nextReconstructItem(rc, corpus);
    if ("done" in it) return null;
    const perm = permute(it.options.length, rc.blankIndex);
    return { item: it, options: perm.map((i) => it.options[i]!), correctIndex: perm.indexOf(0) };
  }, [corpus, rc]);

  if (phase.kind === "loading") {
    return <p className="caption">Preparing the Test…</p>;
  }

  if (phase.kind === "not-writer") {
    return (
      <p className="caption">
        This device has the log open in another tab. Continue there, or close
        it and reload this page.
      </p>
    );
  }

  if (phase.kind === "failed") {
    return (
      <p className="caption" role="alert">
        {phase.message}
      </p>
    );
  }

  if (phase.kind === "unavailable" || !corpus) {
    return (
      <p className="caption">This surah is not available on this device yet.</p>
    );
  }

  if (phase.kind === "range") {
    return (
      <div className="stack" data-testid="test-range">
        <p className="voice">
          A mixed quiz over a range you choose — it never moves your progress.
        </p>
        {defaultPool.length === 0 && (
          <p className="caption">
            Nothing carried yet — pick any range to test recognition.
          </p>
        )}
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
        <button type="button" className="btn hit" onClick={() => void startTest()}>
          Start Test
        </button>
      </div>
    );
  }

  if (phase.kind === "result") {
    const correct = results.filter(Boolean).length;
    const total = results.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
      <div className="stack" data-testid="test-result">
        <div className="banner banner--ok">
          <p>
            {correct} / {total} correct ({pct}%)
          </p>
          <p className="sub">test_result logged — no strength or due-dates moved.</p>
        </div>
        {correct < total && (
          <button type="button" className="btn hit" onClick={() => void finishTest(true)}>
            Send weak ayat to reviews
          </button>
        )}
        <button type="button" className="btn btn--primary hit" onClick={() => void finishTest(false)}>
          Done
        </button>
      </div>
    );
  }

  // running
  if (!current) {
    return <p className="caption">Loading…</p>;
  }

  const locked = feedback !== null;

  return (
    <div className="stack" data-testid="test-running" data-item-index={index} data-item-kind={current.kind}>
      <div className="card-header">
        <span>Test · {current.kind}</span>
        <span>
          {index + 1} / {items.length}
        </span>
      </div>

      {current.kind === "vocab" && mcqDisplay && (
        <>
          <p className="ayah" dir="rtl" lang="ar">
            {current.ayahWords.map((w, i) => (
              <span
                key={w.position}
                style={{ color: w.position === current.position ? "var(--teal-600)" : "var(--text-muted)" }}
              >
                <bdi>{w.text_uthmani}</bdi>
                {i < current.ayahWords.length - 1 ? " " : ""}
              </span>
            ))}
          </p>
          <div className="bank" role="group" aria-label="Meaning choices">
            {mcqDisplay.options.map((o, i) => (
              <span className="tile-hit" key={i}>
                <button
                  type="button"
                  className={["option", optionStateClass(i, mcqDisplay.correctIndex, feedback && feedback.chosenIndex !== undefined ? { chosenIndex: feedback.chosenIndex } : undefined)].filter(Boolean).join(" ")}
                  disabled={locked || busy}
                  onClick={() => void handleMcqTap(current, mcqDisplay.options, i)}
                >
                  {o}
                </button>
              </span>
            ))}
          </div>
        </>
      )}

      {current.kind === "cloze" && mcqDisplay && (
        <>
          <p className="ayah" dir="rtl" lang="ar">
            {current.ayahWords.map((w, i) => (
              <span key={w.position}>
                <span
                  className={"gap-slot" + (w.position === current.blankPosition ? " is-current" : "")}
                  dir="rtl"
                  lang="ar"
                >
                  {w.position === current.blankPosition ? null : <bdi>{w.text_uthmani}</bdi>}
                </span>
                {i < current.ayahWords.length - 1 ? " " : ""}
              </span>
            ))}
          </p>
          <div className="bank" role="group" aria-label="Word choices">
            {mcqDisplay.options.map((o, i) => (
              <span className="tile-hit" key={i}>
                <button
                  type="button"
                  className={["tile", optionStateClass(i, mcqDisplay.correctIndex, feedback && feedback.chosenIndex !== undefined ? { chosenIndex: feedback.chosenIndex } : undefined)].filter(Boolean).join(" ")}
                  disabled={locked || busy}
                  onClick={() => void handleMcqTap(current, mcqDisplay.options, i)}
                >
                  <bdi>{o}</bdi>
                </button>
              </span>
            ))}
          </div>
        </>
      )}

      {current.kind === "junction" && mcqDisplay && (
        <>
          <p className="voice">
            Which ayah opens next, after {surah}:{current.from}?
          </p>
          <div className="bank" role="group" aria-label="Junction choices">
            {mcqDisplay.options.map((o, i) => (
              <span className="tile-hit" key={i}>
                <button
                  type="button"
                  className={["option", "option--arabic", optionStateClass(i, mcqDisplay.correctIndex, feedback && feedback.chosenIndex !== undefined ? { chosenIndex: feedback.chosenIndex } : undefined)].filter(Boolean).join(" ")}
                  disabled={locked || busy}
                  onClick={() => void handleMcqTap(current, mcqDisplay.options, i)}
                >
                  <bdi>{o}</bdi>
                </button>
              </span>
            ))}
          </div>
        </>
      )}

      {current.kind === "locate" && locateDisplay && (
        <>
          <p className="ayah" dir="rtl" lang="ar">
            <bdi>{current.ayahWords.map((w) => w.text_uthmani).join(" ")}</bdi>
          </p>
          <p className="voice">Which ayah is this?</p>
          <div className="bank" role="group" aria-label="Ayah number choices">
            {locateDisplay.options.map((o, i) => (
              <span className="tile-hit" key={i}>
                <button
                  type="button"
                  className={["option", optionStateClass(i, locateDisplay.correctIndex, feedback && feedback.chosenIndex !== undefined ? { chosenIndex: feedback.chosenIndex } : undefined)].filter(Boolean).join(" ")}
                  disabled={locked || busy}
                  onClick={() => void handleLocateTap(current, locateDisplay.options, i)}
                >
                  {surah}:{o}
                </button>
              </span>
            ))}
          </div>
        </>
      )}

      {current.kind === "reorder" && reorderDisplay && (
        <>
          <p className="voice">Tap the ayat back into reading order.</p>
          {reorderAttempt.length > 0 && (
            <p className="caption">
              Order so far: {reorderAttempt.map((a) => `${surah}:${a}`).join(" → ")}
            </p>
          )}
          <div className="bank" role="group" aria-label="Reorder choices">
            {reorderDisplay.map((a) => (
              <span className="tile-hit" key={a}>
                <button
                  type="button"
                  className={"tile" + (reorderAttempt.includes(a) ? " is-used" : "")}
                  disabled={locked || busy || reorderAttempt.includes(a)}
                  onClick={() => void handleReorderTap(current, a)}
                >
                  <bdi>{ayahSnippet(corpus, a)}</bdi>
                </button>
              </span>
            ))}
          </div>
        </>
      )}

      {current.kind === "produce" && rc && (
        <>
          <p className="voice">Produce the whole ayah, cold — no warm-up.</p>
          <p className="ayah" dir="rtl" lang="ar" data-blank-index={rc.blankIndex}>
            {rc.words.map((w, i) => {
              const isBlank = rc.blankPositions.includes(w.position);
              if (!isBlank) {
                return (
                  <span key={w.position}>
                    <bdi>{w.text_uthmani}</bdi>
                    {i < rc.words.length - 1 ? " " : ""}
                  </span>
                );
              }
              const fill = rcFilled.get(w.position);
              const isCurrent = rc.blankPositions[rc.blankIndex] === w.position;
              return (
                <span key={w.position}>
                  <span
                    className={"gap-slot" + (isCurrent ? " is-current" : "") + (fill !== undefined ? " is-filled" : "")}
                    dir="rtl"
                    lang="ar"
                  >
                    {fill !== undefined ? <bdi>{fill}</bdi> : null}
                  </span>
                  {i < rc.words.length - 1 ? " " : ""}
                </span>
              );
            })}
          </p>
          {produceCurrent && (
            <div className="bank" role="group" aria-label="Word choices">
              {produceCurrent.options.map((o, i) => (
                <span className="tile-hit" key={i}>
                  <button
                    type="button"
                    className={["tile", optionStateClass(i, produceCurrent.correctIndex, feedback && feedback.chosenIndex !== undefined ? { chosenIndex: feedback.chosenIndex } : undefined)].filter(Boolean).join(" ")}
                    disabled={locked || busy}
                    onClick={() => void handleProduceTap(current, o)}
                  >
                    <bdi>{o}</bdi>
                  </button>
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {feedback && (
        <>
          <p className="caption" role="status">
            {feedback.ok ? "Correct." : "Not quite."}
          </p>
          <button type="button" className="btn hit" onClick={onContinue}>
            Continue
          </button>
        </>
      )}
    </div>
  );
}
