import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { append, _closeForTest as closeEvents } from "./eventLog.ts";
import { rebuildAtoms, _closeForTest as closeAtoms } from "./atoms.ts";
import { chainSteps, makeEvent } from "engine";

const DAY = 86_400_000;

beforeEach(async () => {
  await closeEvents();
  await closeAtoms();
  globalThis.indexedDB = new IDBFactory();
});

describe("v0.4 exit criterion (app boundary): connection born + reviewed via FIRe", () => {
  it("encode 12:4 → bridge → chain [4,5] rebuilds a born, reviewed connection atom", async () => {
    const t = 5 * DAY + 6 * 3600_000;
    // encode ayah 4
    for (const rung of ["S1", "S2", "S3"] as const) {
      await append(makeEvent({ type: "rung_complete", ts: t, surah: 12, ayah: 4, rung }));
    }
    // S4 bridge → birth the 4→5 connection + a bridge review
    await append(makeEvent({ type: "connection_born", ts: t + 1000, surah: 12, ayah: 4, rung: "S4", to: 5 }));
    await append(makeEvent({ type: "rung_complete", ts: t + 1500, surah: 12, ayah: 5, rung: "S4" }));
    // chain [4,5]: emit a chain_step per traversed atom (FIRe)
    for (const step of chainSteps(4, 5)) {
      const stepAyah = step.kind === "ayah" ? step.ref : step.from;
      await append(
        makeEvent({
          type: "chain_step",
          ts: t + 2000,
          surah: 12,
          ayah: stepAyah,
          rung: "S4",
          stepKind: step.kind,
          to: step.kind === "junction" ? step.to : undefined,
          correct: true,
        }),
      );
    }

    const atoms = await rebuildAtoms();
    // Connection born and reviewed.
    const conn = atoms.get("connection:4");
    expect(conn, "connection:4 born").toBeDefined();
    expect(conn!.strength).toBeGreaterThan(0); // reviewed by junction + chain
    // FIRe credited both ayat too.
    expect(atoms.get("ayah:4")!.encoded).toBe(true);
    expect(atoms.get("ayah:5")).toBeDefined();
    expect(atoms.get("ayah:5")!.strength).toBeGreaterThan(0);
  });

  it("rebuild remains deterministic with bridge/chain events (fold==replay)", async () => {
    const t = 5 * DAY;
    await append(makeEvent({ type: "rung_complete", ts: t, surah: 12, ayah: 4, rung: "S3" }));
    await append(makeEvent({ type: "connection_born", ts: t + 1, surah: 12, ayah: 4, rung: "S4", to: 5 }));
    const a = await rebuildAtoms();
    const b = await rebuildAtoms();
    expect([...a.entries()]).toEqual([...b.entries()]);
  });
});
