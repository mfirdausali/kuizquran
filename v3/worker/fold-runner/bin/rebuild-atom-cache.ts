// THE RUNNER for the admin "rebuild atom cache" action (WIREFRAME §16 /
// build-plan step 24, edge case #168) — the piece `SystemHealthController::
// rebuildAtomCache()` names in its own comment ("the actual re-fold is
// dispatched to the Node fold-runner") but never actually invoked. Before
// this file existed, that comment was aspirational: the endpoint acquired a
// lock, wrote an audit row, and returned `started: true` without folding a
// single event or writing a single `atom_cache` row — and the lock was never
// released, so it simply sat held for its full 600s TTL. See DECISIONS.md
// for the finding.
//
// Contract with the caller (Laravel's RebuildAtomCacheJob):
//
//   stdin  — a JSON envelope:
//     { "engineVersion": "<optional — defaults to this build's pinned version>",
//       "users": [ { "userId": 7, "events": [ DrillEvent, ... ] }, ... ] }
//   stdout — one JSON line, always:
//     { "severity": "green" | "error",
//       "usersProcessed": number, "atomsWritten": number,
//       "rows": [ { userId, surah, kind, ref, strength, stability, difficulty,
//                   lastRetrieval, reps, lapses, encoded, gateDueAt,
//                   gatePassed, gateFails, engineVersion }, ... ],
//       "error"?: string }
//   exit   — 0 on a completed rebuild (including zero users — an empty log
//            genuinely re-derives to zero atoms, which is not a failure the
//            way an empty determinism sample is), 5 on malformed input.
//
// v3-D08: PHP never re-implements engine logic. This script calls the pure
// engine's own rebuild() (via fold.ts#foldEvents, the SAME composition
// fold_determinism_check uses) and does nothing else — Laravel owns writing
// the rows this prints into `atom_cache` (the migration's own comment: "the
// Node fold-runner is the sole server-side fold"; Node never touches the
// database directly, mirroring bin/fold-determinism-check.ts's own reasoning
// for staying stdin/stdout-only).

import { readFileSync } from "node:fs";
import { foldEvents } from "../src/fold.ts";
import { ENGINE_VERSION } from "../src/engineVersion.ts";
import type { DrillEvent } from "../../../packages/engine/src/types.ts";

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

interface Row {
  userId: number | string;
  surah: number;
  kind: string;
  ref: number;
  strength: number;
  stability: number;
  difficulty: number;
  lastRetrieval: number | null;
  reps: number;
  lapses: number;
  encoded: boolean;
  gateDueAt: number | null;
  gatePassed: boolean;
  gateFails: number;
  engineVersion: string;
}

function main(): number {
  const raw = readStdin().trim();
  if (!raw) {
    process.stdout.write(
      JSON.stringify({
        severity: "error",
        error: "no input on stdin — pass a JSON envelope with a `users` array",
      }) + "\n",
    );
    return 5;
  }

  let parsed: { engineVersion?: string; users?: Array<{ userId: number | string; events: DrillEvent[] }> };
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    process.stdout.write(
      JSON.stringify({
        severity: "error",
        error: `stdin was not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
      }) + "\n",
    );
    return 5;
  }

  if (!Array.isArray(parsed.users)) {
    process.stdout.write(
      JSON.stringify({ severity: "error", error: "envelope has no `users` array" }) + "\n",
    );
    return 5;
  }

  const engineVersion = parsed.engineVersion ?? ENGINE_VERSION;
  const rows: Row[] = [];

  for (const user of parsed.users) {
    const atoms = foldEvents(user.events ?? []);
    for (const atom of atoms.values()) {
      rows.push({
        userId: user.userId,
        surah: atom.surah,
        kind: atom.kind,
        ref: atom.ref,
        strength: atom.strength,
        stability: atom.stability,
        difficulty: atom.difficulty,
        lastRetrieval: atom.lastRetrieval,
        reps: atom.reps,
        lapses: atom.lapses,
        encoded: atom.encoded,
        gateDueAt: atom.gateDueAt,
        gatePassed: atom.gatePassed,
        gateFails: atom.gateFails,
        engineVersion,
      });
    }
  }

  process.stdout.write(
    JSON.stringify({
      severity: "green",
      usersProcessed: parsed.users.length,
      atomsWritten: rows.length,
      rows,
    }) + "\n",
  );
  return 0;
}

process.exit(main());
