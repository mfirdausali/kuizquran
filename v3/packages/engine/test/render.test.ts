// Build-plan step 16: WIREFRAME.md §22's render contract — "four shapes,
// closed permanently": choice, sequenceFill (carries cursor), orderTiles
// (carries attempt), locateChoice. A stateless two-member union failed on
// live code (Test.tsx's reorder/produce need stateful fields), so the
// stateful fields (cursor/attempt) live IN the render contract, not
// bolted onto a wrapper.

import { describe, expect, it } from "vitest";
import type { RenderItem } from "../src/render.ts";

describe("RenderItem — four shapes, closed permanently", () => {
  it("choice carries a prompt Face, option Faces, and a correctIndex into them", () => {
    const item: RenderItem = {
      shape: "choice",
      prompt: { text: "x", script: "arabic", from: { kind: "word", ayah: 1, position: 1 } },
      options: [{ text: "a", script: "latin", from: { kind: "gloss", ayah: 1, position: 1, lang: "en" } }],
      correctIndex: 0,
    };
    expect(item.shape).toBe("choice");
  });

  it("sequenceFill carries a cursor (WIREFRAME: the stateful field lives IN the shape)", () => {
    const item: RenderItem = {
      shape: "sequenceFill",
      ayahWords: [],
      blankPositions: [1, 2],
      cursor: 0,
      options: [],
      correctIndex: 0,
    };
    expect(item.cursor).toBe(0);
  });

  it("orderTiles carries an attempt array", () => {
    const item: RenderItem = { shape: "orderTiles", tiles: [], attempt: [], correctOrder: [1, 2, 3] };
    expect(item.attempt).toEqual([]);
  });

  it("locateChoice options are ayah NUMBERS, not Faces (asking 'which ayah', not 'which word')", () => {
    const item: RenderItem = {
      shape: "locateChoice",
      prompt: { text: "x", script: "arabic", from: { kind: "verse", ayah: 4 } },
      options: [4, 5, 6],
      correctIndex: 0,
    };
    expect(typeof item.options[0]).toBe("number");
  });
});
