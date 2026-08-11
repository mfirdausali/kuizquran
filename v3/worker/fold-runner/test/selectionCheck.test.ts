// selection_determinism_check's runner core, against the COMMITTED
// selection log — the fixture the nightly actually runs on.
//
// packages/engine/test/selection.test.ts proves selectFor's purity at unit
// scale with hand-built logs. This file proves the RUNNER: that the fixture
// it will read every night is non-degenerate, that the check reports what it
// compared, and that it goes red when shuffle-invariance breaks.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { selectionDeterminismCheckRun, seededShuffle } from "../src/selectionCheck.ts";
import type { Corpus, DrillEvent } from "../../../packages/engine/src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const V3 = join(HERE, "..", "..", "..");

const EVENTS: DrillEvent[] = JSON.parse(
  readFileSync(join(V3, "fixtures", "selection-log", "events.json"), "utf8"),
);
const CORPUS: Corpus = JSON.parse(
  readFileSync(join(V3, "packages", "engine", "test", "fixtures", "12.json"), "utf8"),
);
const BY_SURAH = new Map<number, Corpus>([[12, CORPUS]]);
const SEEDS = [1, 2, 3, 5, 8, 13];

describe("the committed selection log is a REAL input, not an empty one", () => {
  // This is the guard against the exact trap this task walked into: the
  // GOLDEN log has 24 events and ZERO selection-bearing ones, so a check
  // pointed at it compares nothing and passes forever.
  it("every event carries the three fields replaySelection actually reads", () => {
    expect(EVENTS.length).toBeGreaterThan(0);
    for (const e of EVENTS) {
      expect(e.siteKey, `event ${e.id} has no siteKey`).toBeTruthy();
      expect(e.deviceId, `event ${e.id} has no deviceId`).toBeTruthy();
      expect(typeof e.visitOrdinal, `event ${e.id} has no visitOrdinal`).toBe("number");
    }
  });

  it("contains the two-device merge case BUILD-PLAN names explicitly", () => {
    // Edge case #48: two devices independently number their own visits to
    // the SAME site starting at 1. If the trace key were siteKey alone,
    // one would overwrite the other.
    const bySite = new Map<string, Set<string>>();
    for (const e of EVENTS) {
      if (!bySite.has(e.siteKey!)) bySite.set(e.siteKey!, new Set());
      bySite.get(e.siteKey!)!.add(e.deviceId!);
    }
    const shared = [...bySite.values()].filter((devices) => devices.size > 1);
    expect(shared.length, "no site is visited by two devices").toBeGreaterThan(0);

    // And those devices genuinely collide on ordinals.
    const site = [...bySite.entries()].find(([, d]) => d.size > 1)![0];
    const ordinalsPerDevice = new Map<string, Set<number>>();
    for (const e of EVENTS.filter((x) => x.siteKey === site)) {
      if (!ordinalsPerDevice.has(e.deviceId!)) ordinalsPerDevice.set(e.deviceId!, new Set());
      ordinalsPerDevice.get(e.deviceId!)!.add(e.visitOrdinal!);
    }
    const [a, b] = [...ordinalsPerDevice.values()];
    const overlap = [...a!].filter((o) => b!.has(o));
    expect(overlap.length, "the two devices never reuse an ordinal — not a merge case").toBeGreaterThan(0);
  });

  it("covers BOTH site kinds — ayah and seam", () => {
    const kinds = new Set(EVENTS.map((e) => e.siteKey!.split(":")[1]));
    expect(kinds).toContain("ayah");
    expect(kinds).toContain("seam");
  });

  it("visits at least one site more than once per lane lap, so rotation is actually exercised", () => {
    const counts = new Map<string, number>();
    for (const e of EVENTS) {
      const k = `${e.siteKey}:${e.deviceId}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    expect(Math.max(...counts.values())).toBeGreaterThanOrEqual(10);
  });
});

describe("selectionDeterminismCheckRun", () => {
  it("is green over the committed log, and reports how many traces it compared", () => {
    const report = selectionDeterminismCheckRun(EVENTS, BY_SURAH, SEEDS);
    expect(report.severity).toBe("green");
    expect(report.divergences).toEqual([]);
    expect(report.tracesCompared).toBe(EVENTS.length * SEEDS.length);
  });

  it("names the seeds it ran, so a failing night is reproducible", () => {
    expect(selectionDeterminismCheckRun(EVENTS, BY_SURAH, SEEDS).seeds).toEqual(SEEDS);
  });

  it("reports zero traces — not green-with-content — when the log carries no selection fields", () => {
    // The runner turns this into an ERROR via its floor; the core's job is
    // to report the zero honestly rather than hide it.
    const stripped = EVENTS.map(({ siteKey, deviceId, visitOrdinal, ...rest }) => rest as DrillEvent);
    const report = selectionDeterminismCheckRun(stripped, BY_SURAH, SEEDS);
    expect(report.tracesCompared).toBe(0);
  });

  it("reports zero traces when the corpus for the log's surah is missing", () => {
    const report = selectionDeterminismCheckRun(EVENTS, new Map(), SEEDS);
    expect(report.tracesCompared).toBe(0);
  });

  it("CATCHES a genuine arrival-order dependence, naming the seed and the trace key", () => {
    // The check must be able to FAIL, or every green above is worthless.
    //
    // Constructing a real violation is not trivial, precisely because
    // `selectFor` is pure — which is the property under test. So the
    // violation is injected where an actual regression would live: in a
    // replay that consults the events AROUND an event instead of only the
    // event's own recorded facts. That is the mergeFromServer-reordering
    // bug class this check exists to catch (BUILD-PLAN: "the shuffling is
    // the point — it is what catches the mergeFromServer reordering").
    const orderDependentReplay = (events: DrillEvent[]) => {
      const trace = new Map<string, unknown>();
      events.forEach((e, index) => {
        const key = `${e.siteKey}:${e.deviceId}:${e.visitOrdinal}`;
        // THE BUG: the value depends on the event's POSITION in the log.
        trace.set(key, { lane: index % 2 === 0 ? "s1" : "s2" });
      });
      return trace;
    };

    const baseline = orderDependentReplay(EVENTS);
    const shuffled = orderDependentReplay(seededShuffle(EVENTS, 1));

    const differing = [...baseline.keys()].filter(
      (k) => JSON.stringify(baseline.get(k)) !== JSON.stringify(shuffled.get(k)),
    );
    expect(
      differing.length,
      "the injected order-dependence did not actually diverge — the test proves nothing",
    ).toBeGreaterThan(0);

    // And the real check, given inputs that DO diverge, reports it as a P1
    // with the seed and trace key attached. Proven by feeding the check a
    // log whose two halves disagree about the same (site, device, ordinal):
    // the trace slot is written twice and the winner depends on order.
    const contradictory: DrillEvent[] = [
      { ...EVENTS[0]!, id: "x1", surah: 12 },
      // Same trace key, but a DIFFERENT site kind behind it, so selectFor
      // is handed a different Site for the identical key.
      { ...EVENTS[0]!, id: "x2", siteKey: EVENTS[0]!.siteKey, ayah: 9 },
    ];
    const forward = selectionDeterminismCheckRun(contradictory, BY_SURAH, [1, 2, 3, 5, 8, 13, 21]);
    expect(forward.severity).toBe("p1");
    expect(forward.divergences.length).toBeGreaterThan(0);
    expect(forward.divergences[0]!.traceKey).toBeTruthy();
    expect(typeof forward.divergences[0]!.seed).toBe("number");
  });

  it("shuffling is real — the seeds produce genuinely different orderings", () => {
    // A seededShuffle that returned its input would make every green above
    // meaningless. Proven, not assumed.
    const a = seededShuffle(EVENTS, 1).map((e) => e.id).join(",");
    const b = seededShuffle(EVENTS, 2).map((e) => e.id).join(",");
    const original = EVENTS.map((e) => e.id).join(",");
    expect(a).not.toBe(original);
    expect(a).not.toBe(b);
  });

  it("seededShuffle is deterministic — the same seed gives the same order (failure-seed pinning)", () => {
    expect(seededShuffle(EVENTS, 7).map((e) => e.id)).toEqual(seededShuffle(EVENTS, 7).map((e) => e.id));
  });

  it("seededShuffle is a permutation — no event is lost or duplicated", () => {
    const shuffled = seededShuffle(EVENTS, 13);
    expect(shuffled.length).toBe(EVENTS.length);
    expect(new Set(shuffled.map((e) => e.id)).size).toBe(EVENTS.length);
  });

  it("does not mutate its input log", () => {
    const before = EVENTS.map((e) => e.id).join(",");
    seededShuffle(EVENTS, 3);
    selectionDeterminismCheckRun(EVENTS, BY_SURAH, SEEDS);
    expect(EVENTS.map((e) => e.id).join(",")).toBe(before);
  });
});
