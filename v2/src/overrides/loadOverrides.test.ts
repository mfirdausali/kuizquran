import { afterEach, describe, expect, it, vi } from "vitest";
import { loadOverrides } from "./loadOverrides.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadOverrides — public GET /overrides, wire snake_case -> engine camelCase", () => {
  it("maps the wire shape to QuestionOverride", async () => {
    const wire = {
      overrides: [
        {
          id: 1,
          surah: 12,
          ayah: 4,
          position: 2,
          question_type: "S1",
          field: "gloss",
          payload: { lang: "en", text: "spoke" },
          editor_id: 7,
          note: "clarified",
          created_at: 12345,
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        expect(url).toContain("/overrides?surah=12");
        return new Response(JSON.stringify(wire));
      }),
    );

    const overrides = await loadOverrides(12);
    expect(overrides).toEqual([
      {
        id: 1,
        surah: 12,
        ayah: 4,
        position: 2,
        questionType: "S1",
        field: "gloss",
        payload: { lang: "en", text: "spoke" },
        editorId: 7,
        note: "clarified",
        createdAt: 12345,
      },
    ]);
  });

  it("is offline-safe: a network failure returns [] rather than throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(loadOverrides(12)).resolves.toEqual([]);
  });

  it("returns [] on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect(loadOverrides(12)).resolves.toEqual([]);
  });
});
