// Generates the SELECTION log — the shuffled-log input that
// selection_determinism_check runs against nightly.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHY THIS FIXTURE HAD TO EXIST BEFORE THE CHECK COULD BE HONEST
// ═══════════════════════════════════════════════════════════════════════════
// BUILD-PLAN.md says selection_determinism_check "runs against the shuffled
// golden log". But `fixtures/golden-log/events.json` was cut at build-plan
// step 2, and the selection wire fields (siteKey, deviceId, visitOrdinal)
// were not frozen until step 10. Measured, not assumed:
//
//     events: 24 · selection-bearing: 0
//
// `replaySelection` skips any event lacking visitOrdinal or deviceId, so a
// runner pointed at the golden log would build an EMPTY trace, compare
// nothing against nothing, and exit green every night forever. That is
// precisely v3-D50's failure mode — a verification that asserts the
// ingredient rather than the output — and it would have shipped a ninth one.
//
// So the selection check gets its own log, generated here, carrying the
// fields it actually reads. The golden log stays exactly as it is: it is the
// FOLD's fixture, and fold_determinism_check still uses it unchanged.
//
// ═══════════════════════════════════════════════════════════════════════════
// NO QURANIC ARABIC
// ═══════════════════════════════════════════════════════════════════════════
// Same discipline as the golden log, for the same reason: `choice` is never
// populated. Every event here is structural coordinates only —
// surah/ayah/position numbers, a siteKey built from those numbers, a device
// id, an ordinal. The Arabic that eventually renders comes from the compiled
// corpus at replay time, never from this file. (CLAUDE.md rule 1.)
//
// ═══════════════════════════════════════════════════════════════════════════
// COVERAGE — what each block exists to catch
// ═══════════════════════════════════════════════════════════════════════════
// A. Single device, many visits to one site (ordinals 1..12). Exercises both
//    rotation layers: the lane lap permutation AND the within-lane affine
//    cycle, over more than one full lap.
// B. Several sites, interleaved. Catches a replay that accidentally keys its
//    trace on ordinal alone and lets two sites' visits overwrite each other.
// C. THE TWO-DEVICE MERGE (WIREFRAME edge case #48, named explicitly by
//    BUILD-PLAN.md's own description of this check). Two devices visit the
//    SAME site and independently number their visits 1,2,3 — because each
//    device numbers its own visits offline. Their events then merge into one
//    server log. If the trace key were siteKey alone, device B's visit 1
//    would overwrite device A's visit 1 and the merge would silently lose a
//    selection. The key is (siteKey, deviceId, visitOrdinal), so it does not.
//    A shuffle interleaves the two devices' events differently every seed —
//    which is the whole point: arrival order must not decide selection.
// D. A SEAM site (kind "seam" — the n->n+1 junction, site.ts's own second
//    SiteKind), not just ayah sites. The site space has two shapes and a
//    check that only ever saw one would miss a regression in the other;
//    `siteFromEvent` has a live `parts[1] === "seam"` branch that no
//    ayah-only fixture ever enters.
//
// Run: TZ=UTC npx tsx v3/scripts/gen-selection-log.ts   (or `make selection-log`)

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { makeEvent } from "../packages/engine/src/events.ts";
import { siteKey } from "../packages/engine/src/site.ts";
import type { Site } from "../packages/engine/src/site.ts";
import type { DrillEvent } from "../packages/engine/src/types.ts";

const MIN = 60_000;
const T0 = 1_767_607_200_000; // same epoch anchor as the golden log

// Surah 12 (Yusuf) — the only compiled corpus fixture this repo has
// (packages/engine/test/fixtures/12.json). When a second surah's corpus
// lands, add a block here; the check reads whatever surahs the log names.
const SURAH = 12;

const events: DrillEvent[] = [];
let clock = T0;
const seqByDevice = new Map<string, number>();

function emit(site: Site, deviceId: string, visitOrdinal: number, id: string): void {
  const seq = (seqByDevice.get(deviceId) ?? 0) + 1;
  seqByDevice.set(deviceId, seq);
  clock += MIN;
  events.push(
    makeEvent({
      type: "tap",
      ts: clock,
      surah: site.surah,
      ayah: site.ayah,
      rung: "S1",
      position: 1,
      structured: true,
      id,
      siteKey: siteKey(site),
      visitOrdinal,
      deviceId,
      deviceSeq: seq,
      tz: "UTC",
      locale: "ms",
    }),
  );
}

// ── A. one device, 12 visits to one ayah site (>1 full lane lap) ──────────
const AYAH4: Site = { kind: "ayah", surah: SURAH, ayah: 4 };
for (let ord = 1; ord <= 12; ord++) emit(AYAH4, "device-a", ord, `s-a${ord}`);

// ── B. several sites, interleaved ────────────────────────────────────────
const AYAH5: Site = { kind: "ayah", surah: SURAH, ayah: 5 };
const AYAH6: Site = { kind: "ayah", surah: SURAH, ayah: 6 };
for (let ord = 1; ord <= 5; ord++) {
  emit(AYAH5, "device-a", ord, `s-b5${ord}`);
  emit(AYAH6, "device-a", ord, `s-b6${ord}`);
}

// ── C. the two-device merge (edge case #48) ──────────────────────────────
// Both devices number their OWN visits to AYAH7 starting at 1. Offline, they
// cannot see each other's ordinals; the server receives both.
const AYAH7: Site = { kind: "ayah", surah: SURAH, ayah: 7 };
for (let ord = 1; ord <= 4; ord++) emit(AYAH7, "device-a", ord, `s-c-a${ord}`);
for (let ord = 1; ord <= 4; ord++) emit(AYAH7, "device-b", ord, `s-c-b${ord}`);

// ── D. a seam site (the n->n+1 junction) ─────────────────────────────────
const SEAM8: Site = { kind: "seam", surah: SURAH, ayah: 8 };
for (let ord = 1; ord <= 6; ord++) emit(SEAM8, "device-a", ord, `s-d${ord}`);

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "fixtures", "selection-log");
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "events.json"), JSON.stringify(events, null, 2) + "\n");

const devices = new Set(events.map((e) => e.deviceId));
const sites = new Set(events.map((e) => e.siteKey));
process.stdout.write(
  `wrote ${events.length} selection-bearing events · ${sites.size} sites · ${devices.size} devices\n`,
);
