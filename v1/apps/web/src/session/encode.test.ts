// Integration test: drive the full Learn ladder for ayah 12:4 through the SAME
// commit-before-feedback path the hook uses (advance → append), against a real
// (fake) IndexedDB, and assert the durable event log records a complete encode
// ending in ayah_complete. This is the v0.2 exit criterion, proven headlessly;
// GATE B is the human's on-screen confirmation of the same flow.

import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advance,
  initLadder,
  makeEvent,
  nextItem,
  type Corpus,
  type DrillItem,
  type LadderState,
} from "engine";
import { append, getAll, _closeForTest } from "../db/eventLog.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  readFileSync(resolve(HERE, "../../../../public/corpus.json"), "utf8"),
) as Corpus;

beforeEach(async () => {
  await _closeForTest();
  globalThis.indexedDB = new IDBFactory();
});

function correctAnswer(item: Extract<DrillItem, { rung: string }>): string {
  if (item.rung === "S1" || item.rung === "S2" || item.rung === "S4") return item.correct;
  return item.ayahWords.find((w) => w.position === item.expectedPosition)!.text_uthmani;
}

/** Mirror the hook's per-tap contract: advance, then durably append BEFORE moving on. */
async function tap(state: LadderState, choice: string) {
  const current = nextItem(state, corpus) as Extract<DrillItem, { rung: string }>;
  const r = advance(state, corpus, choice);
  const position =
    current.rung === "S1"
      ? current.word.position
      : current.rung === "S2"
        ? current.blankPosition
        : current.rung === "S3"
          ? current.expectedPosition
          : 0;
  await append(
    makeEvent({
      type: "tap",
      ts: 1,
      surah: 12,
      ayah: 4,
      rung: current.rung,
      position,
      choice,
      correct: r.correct,
      pretest: r.pretest,
    }),
  );
  if (r.rungCompleted)
    await append(makeEvent({ type: "rung_complete", ts: 1, surah: 12, ayah: 4, rung: r.rungCompleted }));
  if (r.ayahCompleted)
    await append(makeEvent({ type: "ayah_complete", ts: 1, surah: 12, ayah: 4, rung: "S3" }));
  return r;
}

describe("v0.2 exit criterion: encode ayah 12:4 end-to-end", () => {
  it("all-correct encode persists rung_complete×3 and ayah_complete, in order", async () => {
    let state = initLadder(corpus, 12, 4);
    let guard = 0;
    while (guard++ < 500) {
      const item = nextItem(state, corpus);
      if ("done" in item) break;
      const r = await tap(state, correctAnswer(item as Extract<DrillItem, { rung: string }>));
      state = r.state;
      if (r.ayahCompleted) break;
    }

    const events = await getAll();
    // rung completions land in ladder order.
    const rungCompletes = events.filter((e) => e.type === "rung_complete").map((e) => e.rung);
    expect(rungCompletes).toEqual(["S1", "S2", "S3"]);
    // exactly one ayah_complete, and it is the LAST event (the accomplishment).
    const ayahCompletes = events.filter((e) => e.type === "ayah_complete");
    expect(ayahCompletes).toHaveLength(1);
    expect(events.at(-1)!.type).toBe("ayah_complete");
    // every event durably has a monotonic seq.
    const seqs = events.map((e) => e.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
  });

  it("a slip mid-encode is recorded but does not lose the completed encode", async () => {
    let state = initLadder(corpus, 12, 4);
    // Deliberately slip once in S1 (first word wrong), then finish correctly.
    const first = nextItem(state, corpus) as Extract<DrillItem, { rung: "S1" }>;
    const wrong = first.options.find((o) => o !== first.correct)!;
    state = (await tap(state, wrong)).state;

    let guard = 0;
    while (guard++ < 500) {
      const item = nextItem(state, corpus);
      if ("done" in item) break;
      const r = await tap(state, correctAnswer(item as Extract<DrillItem, { rung: string }>));
      state = r.state;
      if (r.ayahCompleted) break;
    }

    const events = await getAll();
    const slips = events.filter((e) => e.type === "tap" && e.correct === false);
    expect(slips.length).toBeGreaterThanOrEqual(1);
    expect(slips[0]!.pretest).toBe(true); // first-pass meaning error is pretest
    // Encode still completes.
    expect(events.at(-1)!.type).toBe("ayah_complete");
  });
});
