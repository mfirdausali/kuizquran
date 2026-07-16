import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { append, _closeForTest as closeEvents } from "./eventLog.ts";
import { rebuildAtoms, _closeForTest as closeAtoms } from "./atoms.ts";
import { makeEvent } from "engine";

const DAY = 86_400_000;

beforeEach(async () => {
  await closeEvents();
  await closeAtoms();
  globalThis.indexedDB = new IDBFactory();
});

describe("atoms cache rebuilds from the event log (invariant #2, app boundary)", () => {
  it("an encode written to the log rebuilds to an encoded, gate-scheduled atom", async () => {
    const t = 5 * DAY + 6 * 3600_000;
    await append(makeEvent({ type: "rung_start", ts: t, surah: 12, ayah: 4, rung: "S1" }));
    await append(makeEvent({ type: "rung_complete", ts: t + 1, surah: 12, ayah: 4, rung: "S1" }));
    await append(makeEvent({ type: "rung_complete", ts: t + 2, surah: 12, ayah: 4, rung: "S2" }));
    await append(makeEvent({ type: "rung_complete", ts: t + 3, surah: 12, ayah: 4, rung: "S3" }));
    await append(makeEvent({ type: "ayah_complete", ts: t + 4, surah: 12, ayah: 4, rung: "S3" }));

    const atoms = await rebuildAtoms();
    const atom = atoms.get("ayah:4")!;
    expect(atom).toBeDefined();
    expect(atom.encoded).toBe(true);
    expect(atom.gateDueAt).not.toBeNull(); // day-1 cold gate scheduled
    expect(atom.gatePassed).toBe(false);
    expect(atom.strength).toBeGreaterThan(0);
  });

  it("rebuild is deterministic — same log rebuilds to the same atoms", async () => {
    const t = 5 * DAY;
    for (const rung of ["S1", "S2", "S3"] as const) {
      await append(makeEvent({ type: "rung_complete", ts: t, surah: 12, ayah: 4, rung }));
    }
    const a = await rebuildAtoms();
    const b = await rebuildAtoms();
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it("surviving a simulated crash: reopen and rebuild yields the same encoded atom", async () => {
    const t = 5 * DAY;
    for (const rung of ["S1", "S2", "S3"] as const) {
      await append(makeEvent({ type: "rung_complete", ts: t, surah: 12, ayah: 4, rung }));
    }
    const before = (await rebuildAtoms()).get("ayah:4")!;
    // simulate process kill: drop both handles, reopen from disk
    await closeEvents();
    await closeAtoms();
    const after = (await rebuildAtoms()).get("ayah:4")!;
    expect(after).toEqual(before);
  });
});
