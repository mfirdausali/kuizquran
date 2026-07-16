import { afterEach, describe, expect, it, vi } from "vitest";
import { CorpusLoadError, loadCorpus } from "./loadCorpus.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadCorpus — surah-keyed loader (v2-D29: no hardcoded surah)", () => {
  it("fetches the surah-specific path and returns the parsed corpus", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe("/corpus/12.json");
      return new Response(JSON.stringify({ meta: { surah: 12, ayahCount: 1, wordCount: 1 } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const corpus = await loadCorpus(12);
    expect(corpus.meta.surah).toBe(12);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("is parameterized — a different surah fetches a different path, no hardcoded 12", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe("/corpus/2.json");
      return new Response(JSON.stringify({ meta: { surah: 2, ayahCount: 286, wordCount: 1 } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const corpus = await loadCorpus(2);
    expect(corpus.meta.surah).toBe(2);
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", { status: 404 })),
    );
    await expect(loadCorpus(999)).rejects.toBeInstanceOf(CorpusLoadError);
  });

  it("throws if the fetched file's meta.surah doesn't match the request (guards a misnamed file)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ meta: { surah: 12, ayahCount: 1, wordCount: 1 } }))),
    );
    await expect(loadCorpus(2)).rejects.toBeInstanceOf(CorpusLoadError);
  });
});
