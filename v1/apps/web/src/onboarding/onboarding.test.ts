import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { append, _closeForTest } from "../db/eventLog.ts";
import { savePlacement, loadPlacement } from "./useOnboarding.ts";
import { makeEvent } from "engine";

beforeEach(async () => {
  await _closeForTest();
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
});

describe("placement persistence (feeds the scheduler)", () => {
  it("round-trips the carried map + start ayah", () => {
    savePlacement({ carriedAyat: [1, 2, 3, 4, 5, 6], startAyah: 7, ayahPerDay: 1 });
    const p = loadPlacement();
    expect(p).toEqual({ carriedAyat: [1, 2, 3, 4, 5, 6], startAyah: 7, ayahPerDay: 1 });
  });

  it("returns null when nothing stored", () => {
    expect(loadPlacement()).toBeNull();
  });
});

describe("first-run detection input", () => {
  it("a fresh log has no events (→ placement); after activity it has events (→ skip)", async () => {
    const { getAll } = await import("../db/eventLog.ts");
    expect(await getAll()).toHaveLength(0); // fresh → needs placement
    await append(makeEvent({ type: "placement_result", ts: 1, surah: 12, ayah: 7, rung: "S1" }));
    expect((await getAll()).length).toBeGreaterThan(0); // has history → ready
  });
});

describe("free-play events carry structured:false", () => {
  it("an open-practice tap is evidence-only", async () => {
    await append(
      makeEvent({
        type: "tap",
        ts: 1,
        surah: 12,
        ayah: 9,
        rung: "S1",
        position: 1,
        choice: "x",
        correct: true,
        structured: false,
      }),
    );
    const { getAll } = await import("../db/eventLog.ts");
    const ev = (await getAll())[0]!;
    expect(ev.structured).toBe(false);
  });
});
