// First-run detection input (mirrors v1's onboarding.test.ts). The hook itself
// needs a React render to observe status transitions; here we test the two
// pieces it composes (which are the actual bug surface — a wrong read here
// misroutes every fresh install straight past placement).
import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { append, getAll, _closeForTest } from "../db/eventLog.ts";
import { loadPlacement, savePlacement } from "../session/placement.ts";
import { makeEvent } from "engine";

beforeEach(async () => {
  await _closeForTest();
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
});

describe("onboarding gate inputs", () => {
  it("a fresh install has no events and no cached placement (→ needed)", async () => {
    expect(await getAll()).toHaveLength(0);
    expect(loadPlacement()).toBeNull();
  });

  it("a cached placement alone is enough to be ready (fast path, no IDB read needed)", () => {
    savePlacement({ carriedAyat: [], startAyah: 1, ayahPerDay: 1 });
    expect(loadPlacement()).not.toBeNull();
  });

  it("prior event-log history (but no local placement cache) also reads as ready", async () => {
    await append(
      makeEvent({ type: "placement_result", ts: 1, surah: 12, ayah: 7, rung: "S1" }),
    );
    expect(loadPlacement()).toBeNull(); // cache absent (e.g. cleared localStorage)
    expect((await getAll()).length).toBeGreaterThan(0); // but history exists → ready
  });
});
