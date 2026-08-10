// Pure event constructors. The append-only event log (apps/web/db/eventLog.ts)
// stamps `seq` on write; the engine only shapes events. No IO here.

import type { DrillEvent, EventType, Rung, TestItemKind } from "./types.ts";

export interface MakeEventArgs {
  /** Stable client id (uuid). If omitted, the app shell stamps one on append. */
  id?: string;
  type: EventType;
  ts: number;
  surah: number;
  ayah: number;
  rung: Rung;
  position?: number;
  choice?: string;
  correct?: boolean;
  pretest?: boolean;
  /** Target ayah (n+1) for connection/junction/chain events. */
  to?: number;
  /** For chain_step: which kind of atom the step traversed. */
  stepKind?: "ayah" | "junction";
  /** False for free-play (evidence-only) events. */
  structured?: boolean;
  /** Tap latency in ms (v0.6 time-per-word metric). */
  latency?: number;
  /** resumePolicy classification for interruption events (v0.6 metric). */
  resume?: "resume" | "restart" | "replan" | "makeup";
  /** v2 Phase 4 Test events only — see DrillEvent. */
  testKind?: TestItemKind;
  score?: number;
  total?: number;
  sentToReviews?: boolean;
}

export function makeEvent(a: MakeEventArgs): DrillEvent {
  const e: DrillEvent = {
    type: a.type,
    ts: a.ts,
    surah: a.surah,
    ayah: a.ayah,
    rung: a.rung,
  };
  if (a.id !== undefined) e.id = a.id;
  if (a.position !== undefined) e.position = a.position;
  if (a.choice !== undefined) e.choice = a.choice;
  if (a.correct !== undefined) e.correct = a.correct;
  if (a.pretest !== undefined) e.pretest = a.pretest;
  if (a.to !== undefined) e.to = a.to;
  if (a.stepKind !== undefined) e.stepKind = a.stepKind;
  if (a.structured !== undefined) e.structured = a.structured;
  if (a.latency !== undefined) e.latency = a.latency;
  if (a.resume !== undefined) e.resume = a.resume;
  if (a.testKind !== undefined) e.testKind = a.testKind;
  if (a.score !== undefined) e.score = a.score;
  if (a.total !== undefined) e.total = a.total;
  if (a.sentToReviews !== undefined) e.sentToReviews = a.sentToReviews;
  return e;
}
