import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { advance, initLadder, nextItem } from "../src/ladder.ts";
import type { Corpus, DrillItem, LadderDone } from "../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  readFileSync(resolve(HERE, "../../../public/corpus.json"), "utf8"),
) as Corpus;

const AYAH = 4; // 12:4 — 15 words
function words() {
  return corpus.words.filter((w) => w.ayah === AYAH).sort((a, b) => a.position - b.position);
}

/** The correct answer for any item (S1/S2 carry `correct`; S3 = expected word).
 *  The ladder only ever emits S1/S2/S3 (S4 bridge lives in bridge.ts). */
function correctAnswer(item: Extract<DrillItem, { rung: string }>): string {
  if (item.rung === "S1" || item.rung === "S2" || item.rung === "S4") return item.correct;
  // S3: the word at the expected position
  return item.ayahWords.find((w) => w.position === item.expectedPosition)!.text_uthmani;
}

/** Answer every item correctly, driving the ladder to done. Returns the tap log. */
function encodeAllCorrect() {
  let state = initLadder(corpus, 12, AYAH);
  const log: { rung: string; correct: boolean; pretest: boolean; rungCompleted?: string }[] = [];
  let guard = 0;
  while (guard++ < 500) {
    const item = nextItem(state, corpus) as DrillItem | LadderDone;
    if ("done" in item) break;
    const r = advance(state, corpus, correctAnswer(item));
    log.push({
      rung: item.rung,
      correct: r.correct,
      pretest: r.pretest,
      rungCompleted: r.rungCompleted,
    });
    state = r.state;
  }
  return { state, log };
}

describe("ladder S1→S2→S3 over ayah 12:4", () => {
  it("all-correct encode reaches ayah completion via S1,S2,S3 in order", () => {
    const { state, log } = encodeAllCorrect();
    expect(state.ayahComplete).toBe(true);
    const rungsCompleted = log.filter((l) => l.rungCompleted).map((l) => l.rungCompleted);
    expect(rungsCompleted).toEqual(["S1", "S2", "S3"]);
    // Every rung was visited.
    expect(new Set(log.map((l) => l.rung))).toEqual(new Set(["S1", "S2", "S3"]));
  });

  it("a perfect S1 pass is a clean sweep = exactly one pass of 15 items", () => {
    const { log } = encodeAllCorrect();
    const s1taps = log.filter((l) => l.rung === "S1");
    expect(s1taps.length).toBe(words().length); // 15, no repeats when perfect
  });

  it("S3 completion requires full-ayah production first→last (invariant #1)", () => {
    const { log } = encodeAllCorrect();
    const s3taps = log.filter((l) => l.rung === "S3");
    expect(s3taps.length).toBe(words().length); // all 15 words tapped in order
    expect(s3taps.at(-1)!.rungCompleted).toBe("S3");
  });
});

describe("S1 error handling", () => {
  it("flags a first-pass meaning error as pretest, then requeues the word", () => {
    let state = initLadder(corpus, 12, AYAH);
    const first = nextItem(state, corpus) as Extract<DrillItem, { rung: "S1" }>;
    // Answer the first word WRONG (choose a wrong option).
    const wrong = first.options.find((o) => o !== first.correct)!;
    const r = advance(state, corpus, wrong);
    expect(r.pretest).toBe(true); // first-pass meaning error = pretest
    expect(r.correct).toBe(false);
    state = r.state;
    // The missed word must return as a warm-up (requeued) — cannot clean-sweep
    // this pass, so total S1 items will exceed the word count.
    let s1count = 1;
    let guard = 0;
    while (guard++ < 500) {
      const item = nextItem(state, corpus);
      if ("done" in item || item.rung !== "S1") break;
      const rr = advance(state, corpus, item.correct); // now answer correctly
      state = rr.state;
      s1count++;
    }
    expect(s1count).toBeGreaterThan(words().length); // extra items from the requeue
    expect(state.s1CleanSwept).toBe(true); // eventually sweeps clean
  });

  it("after a miss, the next pass re-asks ONLY the missed word (not all words)", () => {
    let state = initLadder(corpus, 12, AYAH);
    const n = words().length;
    // Answer the FIRST word wrong, the rest of the pass correct.
    const first = nextItem(state, corpus) as Extract<DrillItem, { rung: "S1" }>;
    const missedPos = first.word.position;
    state = advance(state, corpus, first.options.find((o) => o !== first.correct)!).state;
    // finish the remaining n-1 words of this pass correctly
    for (let i = 0; i < n - 1; i++) {
      const it = nextItem(state, corpus) as Extract<DrillItem, { rung: "S1" }>;
      state = advance(state, corpus, it.correct).state;
    }
    // Pass exhausted with one miss → next pass should contain EXACTLY the missed word.
    expect(state.rung).toBe("S1");
    expect(state.s1Queue).toEqual([missedPos]);
    // Answering it correctly clean-sweeps and advances to S2.
    const last = nextItem(state, corpus) as Extract<DrillItem, { rung: "S1" }>;
    const r = advance(state, corpus, last.correct);
    expect(r.rungCompleted).toBe("S1");
    expect(r.state.rung).toBe("S2");
  });

  it("a correct answer on a word already seen is NOT pretest", () => {
    let state = initLadder(corpus, 12, AYAH);
    const first = nextItem(state, corpus) as Extract<DrillItem, { rung: "S1" }>;
    const wrong = first.options.find((o) => o !== first.correct)!;
    state = advance(state, corpus, wrong).state; // miss word 1 (pretest)
    // drive to when word 1 comes back around; assert its later correct answer isn't pretest
    let guard = 0;
    let sawRequeuedCorrect = false;
    while (guard++ < 500) {
      const item = nextItem(state, corpus);
      if ("done" in item || item.rung !== "S1") break;
      const isWord1 = item.rung === "S1" && item.word.position === first.word.position;
      const r = advance(state, corpus, item.correct);
      if (isWord1) {
        expect(r.pretest).toBe(false); // second encounter, correct → not pretest
        sawRequeuedCorrect = true;
      }
      state = r.state;
    }
    expect(sawRequeuedCorrect).toBe(true);
  });
});

describe("S2 fill", () => {
  it("a wrong fill is a slip and does not advance the slot", () => {
    // fast-forward through S1 clean
    let state = initLadder(corpus, 12, AYAH);
    let guard = 0;
    while (guard++ < 500) {
      const item = nextItem(state, corpus);
      if ("done" in item) break;
      if (item.rung !== "S1") break;
      state = advance(state, corpus, item.correct).state;
    }
    const s2 = nextItem(state, corpus) as Extract<DrillItem, { rung: "S2" }>;
    expect(s2.rung).toBe("S2");
    const wrong = s2.options.find((o) => o !== s2.correct)!;
    const r = advance(state, corpus, wrong);
    expect(r.correct).toBe(false);
    // still on the same blank
    const again = nextItem(r.state, corpus) as Extract<DrillItem, { rung: "S2" }>;
    expect(again.blankPosition).toBe(s2.blankPosition);
  });
});
