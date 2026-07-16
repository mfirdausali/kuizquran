// "Not you? switch account" (v2-D12) — proves the local reset actually wipes
// everything a returning-ready check or a stale pace/anchor/lang choice could
// leak into a new learner's fresh session.
import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { append, getAll, _closeForTest } from "../db/eventLog.ts";
import { makeEvent, DEFAULT_PACE_MODE } from "engine";
import { resetForNewLearner } from "./resetAccount.ts";
import { getPaceMode, setPaceMode } from "./pace.ts";
import { getAnchorHour, setAnchorHour } from "./anchor.ts";
import { getGlossLang, setGlossLang } from "./glossLang.ts";
import { loadPlacement, savePlacement } from "./placement.ts";

beforeEach(async () => {
  await _closeForTest();
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
});

describe("resetForNewLearner (switch-account reset)", () => {
  it("wipes the event log, placement cache, and every persisted setting", async () => {
    await append(makeEvent({ type: "tap", ts: 1, surah: 12, ayah: 4, rung: "S1", correct: true }));
    savePlacement({ carriedAyat: [1, 2], startAyah: 3, ayahPerDay: 1 });
    setPaceMode("sprint");
    setAnchorHour(8);
    setGlossLang("ms");

    await resetForNewLearner();

    expect(await getAll()).toHaveLength(0);
    expect(loadPlacement()).toBeNull();
    expect(getPaceMode()).toBe(DEFAULT_PACE_MODE);
    expect(getAnchorHour()).toBeNull();
    expect(getGlossLang()).toBe("en");
  });
});
