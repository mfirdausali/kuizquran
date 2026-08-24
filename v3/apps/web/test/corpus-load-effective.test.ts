// `loadEffectiveCorpus` APPLIES OVERRIDES ON THE SERVER — the SSR half of the
// override read-gap v3-D96 closed for the client fetch path only.
//
// `lib/corpus/load.ts#loadCorpus` (behind `/plan`, `/progress`,
// `/progress/list`, `/surah/[surah]`, `/surah/[surah]/[ayah]`, `/drill`,
// `/practice`, `/workbench`) has always read the raw compiled corpus off
// disk, with no override merge — so a qari/admin correction written through
// the already-shipped, already-admin-gated `POST /api/overrides` never
// reached a server-rendered page. This pins the NEW function that closes
// that gap, mirroring `test/corpus-client-overrides.test.ts`'s own shape.
//
// NOT ONE ARABIC BYTE IS TYPED HERE. The override payload below is an
// English marker string over a fixture coordinate (surah 112, ayah 1,
// position 1) — every Arabic byte in this test comes from the real compiled
// corpus read off disk by the real `loadCorpus`.

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SURAH = 112;
const COMPILED = resolve(HERE, `../../../packages/corpus-compiler/output/${SURAH}/corpus.json`);

beforeEach(() => {
  if (!existsSync(COMPILED)) {
    throw new Error(
      `No compiled corpus at ${COMPILED}. Run \`make compile-corpus\` — these ` +
        `tests run against the real corpus on purpose.`,
    );
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const MARKER = "TEST_SSR_OVERRIDE_GLOSS_MARKER";

function installFetch(overrides: unknown[]): { calls: string[] } {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ overrides }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return { calls };
}

describe("loadEffectiveCorpus applies overrides server-side — the SSR read half of the override layer", () => {
  it("patches a word's gloss when a matching override exists", async () => {
    installFetch([
      {
        id: 1,
        surah: SURAH,
        ayah: 1,
        position: 1,
        questionType: "s1",
        field: "gloss",
        payload: { lang: "en", text: MARKER },
        editorId: null,
        note: null,
        createdAt: 1,
      },
    ]);

    const { loadEffectiveCorpus } = await import("@/lib/corpus/load.ts");
    const effective = await loadEffectiveCorpus(SURAH);
    expect(effective).not.toBeNull();
    const word = effective!.corpus.words.find((w) => w.ayah === 1 && w.position === 1);
    expect(word?.gloss.en).toBe(MARKER);
  });

  it("calls the overrides endpoint for the requested surah, server-side", async () => {
    const { calls } = installFetch([]);
    const { loadEffectiveCorpus } = await import("@/lib/corpus/load.ts");
    await loadEffectiveCorpus(SURAH);
    expect(calls.some((c) => c.includes("/api/overrides") && c.includes(`surah=${SURAH}`))).toBe(
      true,
    );
  });

  it("degrades to the raw corpus when the overrides fetch fails — never throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("server error", { status: 500 })),
    );
    const { loadEffectiveCorpus, loadCorpus } = await import("@/lib/corpus/load.ts");
    const raw = await loadCorpus(SURAH);
    const effective = await loadEffectiveCorpus(SURAH);
    expect(effective).not.toBeNull();
    expect(effective!.disabled).toEqual([]);
    expect(effective!.corpus.words.length).toBe(raw!.words.length);
  });

  it("degrades to the raw corpus when fetch itself throws (e.g. the API is unreachable)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connect ECONNREFUSED");
      }),
    );
    const { loadEffectiveCorpus } = await import("@/lib/corpus/load.ts");
    const effective = await loadEffectiveCorpus(SURAH);
    expect(effective).not.toBeNull();
    expect(effective!.disabled).toEqual([]);
  });

  it("surfaces the disabled list too — mirrors the client's EffectiveCorpus, not just .corpus", async () => {
    installFetch([
      {
        id: 1,
        surah: SURAH,
        ayah: 2,
        position: null,
        questionType: "locate",
        field: "disable",
        payload: { disabled: true },
        editorId: null,
        note: null,
        createdAt: 1,
      },
    ]);
    const { loadEffectiveCorpus } = await import("@/lib/corpus/load.ts");
    const effective = await loadEffectiveCorpus(SURAH);
    expect(effective!.disabled).toEqual([{ ayah: 2, position: null, questionType: "locate" }]);
  });

  it("returns null for a surah this build cannot serve, never a throw", async () => {
    installFetch([]);
    const { loadEffectiveCorpus } = await import("@/lib/corpus/load.ts");
    await expect(loadEffectiveCorpus(999)).resolves.toBeNull();
  });

  it("leaves an unrelated word's gloss untouched", async () => {
    installFetch([
      {
        id: 1,
        surah: SURAH,
        ayah: 1,
        position: 1,
        questionType: "s1",
        field: "gloss",
        payload: { lang: "en", text: MARKER },
        editorId: null,
        note: null,
        createdAt: 1,
      },
    ]);
    const { loadEffectiveCorpus, loadCorpus } = await import("@/lib/corpus/load.ts");
    const raw = await loadCorpus(SURAH);
    const effective = await loadEffectiveCorpus(SURAH);
    const other = effective!.corpus.words.find((w) => w.ayah === 1 && w.position === 2);
    const originalOther = raw!.words.find((w) => w.ayah === 1 && w.position === 2);
    expect(other?.gloss.en).toBe(originalOther?.gloss.en);
  });

  it("`loadCorpus` itself is UNCHANGED — still the raw corpus, byte-identical, no override merge", async () => {
    // loadCorpus's own test (corpus-load.test.ts) asserts byte-identity
    // against the compiled artifact; this test pins that loadEffectiveCorpus
    // is a NEW, additive function rather than a behavior change to the
    // existing one every other route still calls directly.
    installFetch([
      {
        id: 1,
        surah: SURAH,
        ayah: 1,
        position: 1,
        questionType: "s1",
        field: "gloss",
        payload: { lang: "en", text: MARKER },
        editorId: null,
        note: null,
        createdAt: 1,
      },
    ]);
    const { loadCorpus } = await import("@/lib/corpus/load.ts");
    const raw = await loadCorpus(SURAH);
    const word = raw!.words.find((w) => w.ayah === 1 && w.position === 1);
    expect(word?.gloss.en).not.toBe(MARKER);
  });
});
