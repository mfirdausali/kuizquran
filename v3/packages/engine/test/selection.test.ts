// Build-plan step 12: selection_determinism_check (WIREFRAME.md §23 Q2,
// BUILD-PLAN.md's own words: "replay a shuffled log and assert the
// recorded ordinals and full selection trace are byte-identical. The
// shuffling is the point — it is what catches the mergeFromServer
// reordering.") — the hard precondition for any question-compiler merge.
//
// The proof shape: selectFor(site, deviceId, visitOrdinal) is a PURE
// function of three RECORDED facts, never of ts/id/arrival order. So
// replaySelection() over a log is shuffle-invariant BY CONSTRUCTION — these
// tests exercise that construction against real corpus data, varying
// seeds, and a genuine 2-device merge (edge case #48: two offline devices
// independently numbering the same site never collide, because the trace
// key is (siteKey, deviceId, visitOrdinal), not siteKey alone).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { selectFor, replaySelection, seedFromKey, LANES } from "../src/selection.ts";
import { makeEvent } from "../src/events.ts";
import { siteKey } from "../src/site.ts";
import type { Corpus, DrillEvent } from "../src/types.ts";
import type { Site } from "../src/site.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus: Corpus = JSON.parse(readFileSync(resolve(HERE, "fixtures/12.json"), "utf8"));
const corpusBySurah = new Map<number, Corpus>([[12, corpus]]);

const AYAH4: Site = { kind: "ayah", surah: 12, ayah: 4 };

/** Deterministic (seeded) Fisher-Yates — NOT Math.random, so a divergence
 *  is reproducible by pinning the failing seed (BUILD-PLAN.md: "commit-
 *  derived seeds, failure-seed pinning"). */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function buildLog(n: number, site: Site, deviceId: string, tsStart = 1000): DrillEvent[] {
  const key = siteKey(site);
  const events: DrillEvent[] = [];
  for (let ord = 1; ord <= n; ord++) {
    events.push(
      makeEvent({
        type: "tap",
        ts: tsStart + ord,
        surah: site.surah,
        ayah: site.ayah,
        rung: "S1",
        siteKey: key,
        visitOrdinal: ord,
        deviceId,
      }),
    );
  }
  return events;
}

describe("seedFromKey — pure, deterministic (no Math.random, Absolute A)", () => {
  it("is a total, deterministic function of its input string", () => {
    expect(seedFromKey("12:ayah:4")).toBe(seedFromKey("12:ayah:4"));
  });

  it("different keys produce different seeds (not a constant)", () => {
    expect(seedFromKey("12:ayah:4")).not.toBe(seedFromKey("12:ayah:5"));
  });
});

describe("selectFor — pure function of (site, deviceId, visitOrdinal) only", () => {
  it("is idempotent: calling twice with the same inputs gives the same result", () => {
    const a = selectFor(corpus, AYAH4, "device-a", 7);
    const b = selectFor(corpus, AYAH4, "device-a", 7);
    expect(a).toEqual(b);
  });

  it("chooses a lane from the LANES the site actually has admissible candidates for", () => {
    const result = selectFor(corpus, AYAH4, "device-a", 1);
    expect(result).not.toBeNull();
    expect(LANES).toContain(result!.lane);
  });

  it("different devices at the SAME site+ordinal can diverge (independent per-device rotation, edge case #48's namespace fix)", () => {
    // Not asserting they always differ (small pools can coincide) — only
    // that device identity is genuinely part of the seed, provable by
    // varying it and observing the sequence is not a constant re-shuffle.
    const a = selectFor(corpus, AYAH4, "device-a", 1);
    const b = selectFor(corpus, AYAH4, "device-zzz-different", 1);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    // At least ONE of several ordinals must differ between two very
    // differently-seeded devices, or device identity isn't actually wired in.
    const anyDiffer = [1, 2, 3, 4, 5].some((ord) => {
      const ra = selectFor(corpus, AYAH4, "device-a", ord)!;
      const rb = selectFor(corpus, AYAH4, "device-zzz-different", ord)!;
      return ra.lane !== rb.lane || ra.variantIndex !== rb.variantIndex;
    });
    expect(anyDiffer).toBe(true);
  });

  it("throws on visitOrdinal < 1 — a caller bug (ordinals are 1-based, site.ts#nextVisitOrdinal's own contract), never silently clamped", () => {
    expect(() => selectFor(corpus, AYAH4, "device-a", 0)).toThrow();
  });

  it("zero immediate repeats at lane+variant granularity across a real multi-lap sweep (WIREFRAME's own measured rotation property)", () => {
    const trace = Array.from({ length: 60 }, (_, i) => selectFor(corpus, AYAH4, "device-a", i + 1)!);
    for (let i = 1; i < trace.length; i++) {
      const repeated = trace[i]!.lane === trace[i - 1]!.lane && trace[i]!.variantIndex === trace[i - 1]!.variantIndex;
      expect(repeated, `immediate repeat at visit ${i + 1}`).toBe(false);
    }
  });
});

describe("replaySelection — order-independent by construction", () => {
  it("recovers one trace entry per (siteKey, deviceId, visitOrdinal), never fewer, never duplicated", () => {
    const log = buildLog(10, AYAH4, "device-a");
    const trace = replaySelection(log, corpusBySurah);
    expect(trace.size).toBe(10);
  });

  it("re-seeing the same event twice (a device's own event re-arriving) does not change the trace", () => {
    const log = buildLog(5, AYAH4, "device-a");
    const withDuplicate = [...log, log[2]!];
    const trace = replaySelection(withDuplicate, corpusBySurah);
    expect(trace.size).toBe(5);
  });

  it("events missing siteKey/visitOrdinal/deviceId (pre-selection-era, edge case #58) are skipped, never crash the replay", () => {
    const bare = makeEvent({ type: "session_start", ts: 1, surah: 12, ayah: 4, rung: "S1" });
    const log = [...buildLog(3, AYAH4, "device-a"), bare];
    expect(() => replaySelection(log, corpusBySurah)).not.toThrow();
    expect(replaySelection(log, corpusBySurah).size).toBe(3);
  });
});

describe("selection_determinism_check — the hard precondition for any compiler merge", () => {
  it("replaying a SHUFFLED log recovers a byte-identical selection trace, across 20 varying seeds", () => {
    const canonical = buildLog(40, AYAH4, "device-a");
    const canonicalTrace = [...replaySelection(canonical, corpusBySurah).entries()].sort();

    for (let seed = 0; seed < 20; seed++) {
      const shuffled = seededShuffle(canonical, seed);
      const shuffledTrace = [...replaySelection(shuffled, corpusBySurah).entries()].sort();
      expect(shuffledTrace, `divergence at shuffle seed ${seed} — pin this seed to reproduce`).toEqual(
        canonicalTrace,
      );
    }
  });

  it("two-device merge: independently-numbered devices at the same site never collide, and the merged log replays deterministically under shuffle (edge case #48/#49)", () => {
    const a = buildLog(15, AYAH4, "device-a", 1000);
    const b = buildLog(15, AYAH4, "device-b", 5000);
    const merged = [...a, ...b];

    const canonicalTrace = replaySelection(merged, corpusBySurah);
    // 30 distinct keys — device identity genuinely partitions the ordinal
    // namespace, so two devices both using ordinals 1..15 never collide.
    expect(canonicalTrace.size).toBe(30);

    const canonicalSorted = [...canonicalTrace.entries()].sort();
    for (let seed = 0; seed < 10; seed++) {
      const shuffled = seededShuffle(merged, seed);
      const shuffledSorted = [...replaySelection(shuffled, corpusBySurah).entries()].sort();
      expect(shuffledSorted, `2-device merge divergence at seed ${seed}`).toEqual(canonicalSorted);
    }
  });

  it("a THREE-way interleave (arrival order fully scrambled across devices and ordinals) still replays identically to canonical order", () => {
    const a = buildLog(10, AYAH4, "device-a", 1000);
    const b = buildLog(10, AYAH4, "device-b", 2000);
    const c = buildLog(10, AYAH4, "device-c", 3000);
    const merged = [...a, ...b, ...c];
    const canonicalSorted = [...replaySelection(merged, corpusBySurah).entries()].sort();

    for (let seed = 100; seed < 115; seed++) {
      const shuffled = seededShuffle(merged, seed);
      const shuffledSorted = [...replaySelection(shuffled, corpusBySurah).entries()].sort();
      expect(shuffledSorted, `3-device interleave divergence at seed ${seed}`).toEqual(canonicalSorted);
    }
  });
});
