// WIREFRAME §14 "Planned absences" — the write half. `setDayAway` commits
// through the SAME commit-before-paint `append()` every other event uses
// (edge case #76: a tab killed mid-toggle loses nothing), and never touches
// an atom (rebuild.ts has no branch for `day_marked_away`, invariant #5).

import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { setDayAway } from "./awayDay.ts";
import { awayDayOffsets, dayIndexOf } from "@engine/awayDays.ts";
import { rebuild } from "@engine/rebuild.ts";
import { getAllEvents } from "@/lib/idb/read";
import { writeLock } from "@/lib/idb/writeLock";
import { resetDbForTests } from "@/lib/idb/db";

const NOW = 1_700_000_000_000;
const TZ = "Asia/Kuala_Lumpur";
const TODAY = dayIndexOf(NOW);

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
  writeLock.forceForTests({ role: "writer" });
});

describe("setDayAway", () => {
  it("commits a day_marked_away event carrying the absolute day index and the toggle", async () => {
    await setDayAway(12, TODAY + 3, true, { now: NOW, tz: TZ });
    const all = await getAllEvents();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      type: "day_marked_away",
      surah: 12,
      awayDayIndex: TODAY + 3,
      away: true,
    });
  });

  it("reaches awayDayOffsets end to end through the real append path", async () => {
    await setDayAway(12, TODAY + 3, true, { now: NOW, tz: TZ });
    const all = await getAllEvents();
    expect(awayDayOffsets(all, NOW)).toEqual([3]);
  });

  it("un-marks a day by appending a new away:false row, never editing in place", async () => {
    await setDayAway(12, TODAY + 3, true, { now: NOW, tz: TZ });
    await setDayAway(12, TODAY + 3, false, { now: NOW + 1000, tz: TZ });
    const all = await getAllEvents();
    expect(all).toHaveLength(2);
    expect(awayDayOffsets(all, NOW)).toEqual([]);
  });

  it("never creates an atom — folds to an empty atoms map", async () => {
    await setDayAway(12, TODAY + 3, true, { now: NOW, tz: TZ });
    const all = await getAllEvents();
    expect(rebuild(all).size).toBe(0);
  });
});
