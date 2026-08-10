// Generates the v3 golden log + its oracle fold. Run with TZ=UTC pinned (see
// the Makefile target) because daybound.ts's local-date getters (the exact
// leak INVARIANTS.md Absolute A names — build-plan step 8 fixes it) make the
// fold TZ-dependent — the oracle is only reproducible if every run pins the
// same TZ. That dependency is itself one of the fixture's triggers (see
// fixtures/golden-log/README.md).
//
// build-plan step 7 (E-01): this script originally folded through v2's
// (frozen, unfixed) engine — correct up through step 6, since the oracle
// then committed was step 6's own pre-E-01 parity target. Now that v3 has
// its own surah-keyed engine (v3/packages/engine, step 5 port + step 7
// keying), regenerating from v2 would silently produce an oracle that does
// NOT reflect the keying fix — so this script now folds through v3's OWN
// engine. `events.json` itself is unaffected (DrillEvent already carries
// `surah` on every event; only the FOLD's key shape changes) — only
// `oracle.json` changes shape when this next runs.
//
// No Quranic Arabic anywhere: DrillEvent.choice is never populated, because
// rebuild()/applyEvent() never read it — the fold only depends on
// type/ts/surah/ayah/rung/correct/pretest/structured/to/stepKind.

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { makeEvent } from "../packages/engine/src/events.ts";
import { rebuild } from "../packages/engine/src/rebuild.ts";
import { DEFAULT_DAY_CONFIG } from "../packages/engine/src/daybound.ts";
import type { DrillEvent } from "../packages/engine/src/types.ts";

if (process.env.TZ !== "UTC") {
  throw new Error("gen-golden-log must run with TZ=UTC pinned (see Makefile target golden-log)");
}

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

// Surah 12 (Yusuf) throughout — the pinned-v2 fixture surah (v2 is single-surah,
// so E-01's cross-surah collision cannot manifest here; that is E-01's own gate).
const SURAH = 12;

const T0 = Date.UTC(2026, 0, 5, 10, 0, 0); // arbitrary daytime anchor, well inside a learning day

let n = 0;
const id = () => `g${String(++n).padStart(2, "0")}`;

const events: DrillEvent[] = [];
const push = (e: DrillEvent) => events.push(e);

// ---- Ayah 1 — invariant 3: pretest is excluded, then a normal S1 pass ----
push(makeEvent({ id: id(), type: "tap", ts: T0, surah: SURAH, ayah: 1, rung: "S1", position: 1, correct: false, pretest: true, structured: true }));
push(makeEvent({ id: id(), type: "rung_complete", ts: T0 + 1 * MIN, surah: SURAH, ayah: 1, rung: "S1", correct: true, structured: true }));

// ---- Ayah 2 — invariant 4: massed (same learning-day) vs spaced (next day) ----
push(makeEvent({ id: id(), type: "rung_complete", ts: T0 + 2 * MIN, surah: SURAH, ayah: 2, rung: "S1", correct: true, structured: true }));
push(makeEvent({ id: id(), type: "rung_complete", ts: T0 + 5 * MIN, surah: SURAH, ayah: 2, rung: "S1", correct: true, structured: true })); // massed: damped x0.35
push(makeEvent({ id: id(), type: "rung_complete", ts: T0 + 1 * DAY + 2 * MIN, surah: SURAH, ayah: 2, rung: "S1", correct: true, structured: true })); // spaced: full gain

// ---- Ayah 3 — invariant 4: the 23:50/00:10 day-boundary pair. rolloverHour is
// 4.5 (04:30 local), so both timestamps fall in the SAME learning-day: a naive
// calendar-date grouping (different getDate()) would wrongly call this spaced.
const day1_2350 = Date.UTC(2026, 0, 10, 23, 50, 0);
const day2_0010 = Date.UTC(2026, 0, 11, 0, 10, 0); // 20 min later, next calendar date
push(makeEvent({ id: id(), type: "rung_complete", ts: day1_2350, surah: SURAH, ayah: 3, rung: "S1", correct: true, structured: true }));
push(makeEvent({ id: id(), type: "rung_complete", ts: day2_0010, surah: SURAH, ayah: 3, rung: "S1", correct: true, structured: true })); // same learning-day: massed

// ---- Ayah 4 — invariant 4: post-lapse stability damped x0.4, never zeroed.
// The gate pass is deliberately SPACED (next learning-day, undamped) so strength
// clears the reinforce band (>=40) before the lapse — a massed gate pass would
// land under 40 and the tap below would exercise the "still in Learn" branch
// instead (see ayah 11 for that case).
push(makeEvent({ id: id(), type: "rung_complete", ts: T0 + 2 * DAY, surah: SURAH, ayah: 4, rung: "S3", correct: true, structured: true })); // encodes, schedules gate
push(makeEvent({ id: id(), type: "gate_result", ts: T0 + 3 * DAY + 3 * HOUR, surah: SURAH, ayah: 4, rung: "S3", correct: true, structured: true })); // spaced gate pass -> reinforce band
push(makeEvent({ id: id(), type: "tap", ts: T0 + 3 * DAY + 4 * HOUR, surah: SURAH, ayah: 4, rung: "S2", position: 2, correct: false, pretest: false, structured: true })); // lapse: damped, not zeroed

// ---- Ayah 5 — invariant 5: free-play moves no strength ----
push(makeEvent({ id: id(), type: "rung_complete", ts: T0 + 3 * DAY, surah: SURAH, ayah: 5, rung: "S1", correct: true, structured: false }));

// ---- Ayah 6 — invariant 5: test_* is a read-only mirror, folds nothing at all ----
push(makeEvent({ id: id(), type: "test_start", ts: T0 + 3 * DAY + 1 * HOUR, surah: SURAH, ayah: 6, to: 8, rung: "S1" }));
push(makeEvent({ id: id(), type: "test_answer", ts: T0 + 3 * DAY + 1 * HOUR + 1 * MIN, surah: SURAH, ayah: 6, rung: "S1", testKind: "vocab", correct: true }));
push(makeEvent({ id: id(), type: "test_result", ts: T0 + 3 * DAY + 1 * HOUR + 2 * MIN, surah: SURAH, ayah: 6, to: 8, rung: "S1", score: 1, total: 1, sentToReviews: false }));

// ---- Ayah 7 — invariant 1: a word-level tap rolls up to the AYAH atom, never a
// per-word atom (rebuild.ts's atomKey space has no "word" kind at all).
push(makeEvent({ id: id(), type: "tap", ts: T0 + 4 * DAY, surah: SURAH, ayah: 7, rung: "S1", position: 3, correct: false, pretest: false, structured: true }));

// ---- Ayah 8->9 — connection atom: birth, junction review, chain-step review ----
push(makeEvent({ id: id(), type: "connection_born", ts: T0 + 5 * DAY, surah: SURAH, ayah: 8, to: 9, rung: "S4" }));
push(makeEvent({ id: id(), type: "junction_result", ts: T0 + 5 * DAY + 1 * MIN, surah: SURAH, ayah: 8, to: 9, rung: "S4", correct: true, structured: true }));
push(makeEvent({ id: id(), type: "chain_step", ts: T0 + 5 * DAY + 2 * MIN, surah: SURAH, ayah: 8, to: 9, rung: "S4", stepKind: "junction", correct: true, structured: true }));

// ---- Ayah 10 — v2-BUG-3 gap guard: a chain_step over a never-encoded ayah is a
// silent no-op (the event lands in the log; no atom is ever created).
push(makeEvent({ id: id(), type: "chain_step", ts: T0 + 5 * DAY + 3 * MIN, surah: SURAH, ayah: 10, rung: "S1", stepKind: "ayah", correct: true, structured: true }));

// ---- Ayah 11 — gate forgiveness: encode, fail the cold gate, accept a demote ----
push(makeEvent({ id: id(), type: "rung_complete", ts: T0 + 6 * DAY, surah: SURAH, ayah: 11, rung: "S3", correct: true, structured: true }));
push(makeEvent({ id: id(), type: "gate_result", ts: T0 + 7 * DAY, surah: SURAH, ayah: 11, rung: "S3", correct: false, structured: true }));
push(makeEvent({ id: id(), type: "gate_demote", ts: T0 + 7 * DAY + 1 * HOUR, surah: SURAH, ayah: 11 }));

// ---- Ayah 12 — gate_demote on an atom that was never created: also a no-op ----
push(makeEvent({ id: id(), type: "gate_demote", ts: T0 + 7 * DAY + 2 * HOUR, surah: SURAH, ayah: 12 }));

// ---- Ayah 13 — the remaining event types carry no strength signal at all
// (rung_start/ayah_complete/interruption/session_start/placement_*/adoption);
// one representative confirms the fold leaves it untouched too.
push(makeEvent({ id: id(), type: "interruption", ts: T0 + 8 * DAY, surah: SURAH, ayah: 13, rung: "S1", resume: "resume" }));

events.sort((a, b) => a.ts - b.ts);
events.forEach((e, i) => (e.seq = i + 1));

const atoms = rebuild(events, DEFAULT_DAY_CONFIG);
const oracle: Record<string, unknown> = {};
for (const key of [...atoms.keys()].sort()) oracle[key] = atoms.get(key);

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "golden-log");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "events.json"), JSON.stringify(events, null, 2) + "\n");
writeFileSync(join(outDir, "oracle.json"), JSON.stringify(oracle, null, 2) + "\n");

console.log(`wrote ${events.length} events, ${Object.keys(oracle).length} oracle atoms -> ${outDir}`);
