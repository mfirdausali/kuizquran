/// <reference types="@cloudflare/vitest-pool-workers" />
import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  gatePassRate,
  cyclesToCleanPass,
  timePerWord,
  anchorAdherence,
  interruptionCompletion,
  lookAlikeSlipRate,
  d30Retention,
  allMetrics,
} from "../src/metrics.ts";

const DAY = 86_400_000;

beforeAll(async () => {
  // full schema incl. v0.6 columns
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, google_sub TEXT UNIQUE NOT NULL, email TEXT NOT NULL, created_at INTEGER NOT NULL, anchor_hour REAL NOT NULL DEFAULT 4.5);",
  );
  await env.DB.exec(
    "CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, type TEXT NOT NULL, ts INTEGER NOT NULL, surah INTEGER, ayah INTEGER, rung TEXT, position INTEGER, choice TEXT, correct INTEGER, pretest INTEGER, to_ayah INTEGER, step_kind TEXT, structured INTEGER, latency INTEGER, resume TEXT, received_at INTEGER NOT NULL);",
  );
});

beforeEach(async () => {
  await env.DB.exec("DELETE FROM events;");
  await env.DB.exec("DELETE FROM users;");
});

let seq = 0;
async function ev(fields: Record<string, unknown>) {
  const cols = ["id", "user_id", "type", "ts", "ayah", "rung", "correct", "pretest", "choice", "latency", "resume", "received_at"];
  const row = {
    id: `e${seq++}`,
    user_id: 1,
    type: "tap",
    ts: 5 * DAY,
    ayah: 4,
    rung: "S1",
    correct: null,
    pretest: null,
    choice: null,
    latency: null,
    resume: null,
    received_at: 0,
    ...fields,
  };
  await env.DB.prepare(
    `INSERT INTO events (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`,
  )
    .bind(...cols.map((c) => (row as Record<string, unknown>)[c]))
    .run();
}
async function user(id = 1, anchor = 4.5) {
  await env.DB.prepare("INSERT INTO users (id, google_sub, email, created_at, anchor_hour) VALUES (?, ?, ?, ?, ?)")
    .bind(id, `sub${id}`, `u${id}@x.com`, 0, anchor)
    .run();
}

describe("gatePassRate", () => {
  it("passed / total of gate_result events", async () => {
    await ev({ type: "gate_result", correct: 1 });
    await ev({ type: "gate_result", correct: 1 });
    await ev({ type: "gate_result", correct: 0 });
    const m = await gatePassRate(env.DB);
    expect(m.value).toBe("67%"); // 2/3
    expect(m.n).toBe(3);
  });
  it("null when no gates", async () => {
    expect((await gatePassRate(env.DB)).value).toBeNull();
  });
});

describe("cyclesToCleanPass", () => {
  it("counts rung_start events up to the S3 completion", async () => {
    // 3 rung_starts, then S3 complete → 3 cycles for (user1, ayah4)
    await ev({ type: "rung_start", ts: 5 * DAY + 1 });
    await ev({ type: "rung_start", ts: 5 * DAY + 2 });
    await ev({ type: "rung_start", ts: 5 * DAY + 3 });
    await ev({ type: "rung_complete", rung: "S3", ts: 5 * DAY + 4 });
    const m = await cyclesToCleanPass(env.DB);
    expect(m.value).toBe("3.0");
    expect(m.n).toBe(1);
  });
});

describe("timePerWord", () => {
  it("median latency in seconds, excluding >5min", async () => {
    for (const l of [10000, 20000, 30000, 999999]) await ev({ type: "tap", latency: l });
    const m = await timePerWord(env.DB);
    expect(m.n).toBe(3); // 999999 excluded
    expect(m.value).toBe("20.0 s"); // median of 10/20/30
  });
});

describe("anchorAdherence", () => {
  it("fraction of active days whose first event is within 90 min of anchor", async () => {
    await user(1, 8); // anchor 08:00
    // day A: first event at 08:30 local → within
    const dayA = new Date(2026, 6, 14, 8, 30).getTime();
    await ev({ type: "tap", ts: dayA, user_id: 1 });
    // day B: first event at 14:00 local → outside
    const dayB = new Date(2026, 6, 15, 14, 0).getTime();
    await ev({ type: "tap", ts: dayB, user_id: 1 });
    const m = await anchorAdherence(env.DB);
    expect(m.n).toBe(2);
    expect(m.value).toBe("50%");
  });
});

describe("interruptionCompletion", () => {
  it("fraction of interrupted days that reached ayah_complete", async () => {
    // day 5: interrupted + completed
    await ev({ type: "interruption", ts: 5 * DAY + 1, resume: "replan" });
    await ev({ type: "ayah_complete", ts: 5 * DAY + 2 });
    // day 6: interrupted, NOT completed
    await ev({ type: "interruption", ts: 6 * DAY + 1, resume: "makeup" });
    const m = await interruptionCompletion(env.DB);
    expect(m.n).toBe(2);
    expect(m.value).toBe("50%");
  });
});

describe("lookAlikeSlipRate", () => {
  it("wrong graded taps / all graded taps (pretest excluded)", async () => {
    await ev({ type: "tap", correct: 1 });
    await ev({ type: "tap", correct: 0, choice: "wrong" });
    await ev({ type: "tap", correct: 0, pretest: 1 }); // pretest excluded
    const m = await lookAlikeSlipRate(env.DB);
    expect(m.n).toBe(2); // pretest excluded
    expect(m.value).toBe("50%");
  });
});

describe("d30Retention", () => {
  it("is time-gated: null value with an accrues note", async () => {
    await ev({ type: "tap", ts: 5 * DAY });
    const m = await d30Retention(env.DB);
    expect(m.value).toBeNull();
    expect(m.note).toMatch(/accrues/);
  });
});

describe("allMetrics", () => {
  it("returns all 7 §3 metrics in order", async () => {
    await user(1);
    const ms = await allMetrics(env.DB);
    expect(ms.map((m) => m.key)).toEqual([
      "gate_pass", "anchor", "cycles", "slip_rate", "d30", "interruption", "time_per_word",
    ]);
  });
});
