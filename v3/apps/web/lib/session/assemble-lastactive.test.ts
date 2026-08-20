// RED-first proof that `assembleFor` derives `lastActiveDay` through the
// engine's canonical `activity.ts#lastActiveDayMs`, not an inline re-derivation.
//
// `activity.ts`'s own docstring states the intent plainly: it "derives the real
// value straight from the append-only event log ... so the session caller has
// no excuse to hardcode it again." Yet `assembleFor` hardcoded it anyway — an
// inline `prior.reduce((max, e) => (e.ts > max ? e.ts : max), 0)` — so
// `lastActiveDayMs` had ZERO production callers (v3-D107/D108 named this
// exactly: "re-derived by hand in run.ts instead of imported ... the same
// 're-derive instead of import' shape as v3-D83's gradeClassToWire finding").
// The inline copy also floors at 0 where the engine floors at -Infinity — a
// latent divergence the single-source-of-truth call removes.
//
// This mirrors the gradeClassToWire wiring proof (v3-D83): a spy seam over the
// engine function makes the WIRING observable, not merely the value. A caller
// that genuinely routes through `lastActiveDayMs()` reflects the override; a
// caller that re-derives inline does not.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Corpus, DrillEvent } from "@engine/types.ts";

// Capture exactly what `assembleQueue` receives, without changing what it does.
let capturedLastActiveDay: number | null | undefined;
vi.mock("@engine/scheduler.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@engine/scheduler.ts")>();
  return {
    ...actual,
    assembleQueue: (input: Parameters<typeof actual.assembleQueue>[0]) => {
      capturedLastActiveDay = input.lastActiveDay;
      return actual.assembleQueue(input);
    },
  };
});

// A spy seam over the canonical derivation. When set, it OVERRIDES the real
// one, so a caller that routes through `lastActiveDayMs()` observably reflects
// the override; a caller re-deriving inline is blind to it.
let lastActiveDayMsSpy: ((events: DrillEvent[]) => number | null) | null = null;
vi.mock("@engine/activity.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@engine/activity.ts")>();
  return {
    ...actual,
    lastActiveDayMs: (events: DrillEvent[]) =>
      lastActiveDayMsSpy ? lastActiveDayMsSpy(events) : actual.lastActiveDayMs(events),
  };
});

const T0 = Date.UTC(2026, 7, 11, 9, 0, 0);

// A fixed, NON-empty prior, so the inline `reduce(..., 0)` returns a concrete
// max ts (T0) that is DISTINCT from the spy's sentinel — making the two
// derivations observably different. A single `session_start` folds to no atom,
// so `assembleQueue` still runs against the real 112 corpus.
const PRIOR = [
  {
    type: "session_start",
    ts: T0,
    surah: 112,
    ayah: 1,
    rung: "RC",
    id: "seed-1",
    deviceId: "dev-1",
    deviceSeq: 1,
    tz: "UTC",
  } as unknown as DrillEvent,
];
vi.mock("@/lib/idb/read", () => ({
  getEventsForSurah: async () => PRIOR,
}));

import { assembleFor } from "./run";

const HERE = dirname(fileURLToPath(import.meta.url));
const STAGED = resolve(HERE, "../../public/corpus/112.json");
const COMPILED = resolve(HERE, "../../../../packages/corpus-compiler/output/112/corpus.json");

let CORPUS: Corpus;
beforeAll(() => {
  const path = existsSync(STAGED) ? STAGED : COMPILED;
  if (!existsSync(path)) {
    throw new Error(`No 112 corpus at ${STAGED} or ${COMPILED}. Run \`make compile-corpus\`.`);
  }
  CORPUS = JSON.parse(readFileSync(path, "utf8")) as Corpus;
});

beforeEach(() => {
  capturedLastActiveDay = undefined;
  lastActiveDayMsSpy = null;
});

describe("assembleFor derives lastActiveDay via engine activity.ts#lastActiveDayMs (v3-D113)", () => {
  it("routes the engine's lastActiveDayMs() return into assembleQueue", async () => {
    // A sentinel distinct from PRIOR's max ts (T0). If assembleFor re-derives
    // inline it hands assembleQueue T0; if it routes through the engine
    // function it hands assembleQueue the sentinel.
    const SENTINEL = T0 - 86_400_000;
    lastActiveDayMsSpy = () => SENTINEL;

    await assembleFor({ surah: 112, now: T0 + 86_400_000 }, CORPUS);

    expect(capturedLastActiveDay).toBe(SENTINEL);
  });

  it("hands the real max-ts through when the engine function is not overridden", async () => {
    lastActiveDayMsSpy = null; // the real engine derivation

    await assembleFor({ surah: 112, now: T0 + 86_400_000 }, CORPUS);

    // max ts of PRIOR — the value the engine's own lastActiveDayMs returns.
    expect(capturedLastActiveDay).toBe(T0);
  });
});
