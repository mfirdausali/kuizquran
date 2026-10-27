// `fetchCorpus` APPLIES OVERRIDES — the read-side wiring gap this run's
// sweep found (see DECISIONS.md's newest entry, matching the v3-D82..D95
// "mechanism built and unit-tested, zero production callers" shape).
//
// `packages/engine/src/overrides.ts#applyOverrides` is the ONE place override
// precedence is decided (its own docblock: "callers just pass the patched
// corpus instead of the raw one"). `POST /api/overrides` (admin-gated) and
// `GET /api/overrides` (PUBLIC read — OversidesController::index's own
// docblock: "every client, including an anonymous not-yet-synced device,
// needs these to build correct questions") are both real and independently
// tested on the Laravel side. But `lib/corpus/client.ts#fetchCorpus` — what
// `components/session/SessionIsland.tsx` actually drills a learner against —
// never called `applyOverrides` and never fetched `/api/overrides` at all.
// A qari/admin correction (a fixed gloss, a swapped distractor) never
// reached anyone actually being graded.
//
// NOT ONE ARABIC BYTE IS TYPED HERE. The override payload below is an
// English marker string over a fixture coordinate (surah 112, ayah 1,
// position 1) — every Arabic byte in this test comes from the real
// compiled corpus read off disk.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Corpus } from "@engine/types.ts";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch.ts";
import { resetTokenForTests } from "@/lib/sync/token.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SURAH = 112;
const STAGED = resolve(HERE, `../public/corpus/${SURAH}.json`);
const COMPILED = resolve(HERE, `../../../packages/corpus-compiler/output/${SURAH}/corpus.json`);

let corpus: Corpus;

beforeEach(async () => {
  const path = existsSync(STAGED) ? STAGED : COMPILED;
  if (!existsSync(path)) {
    throw new Error(
      `No corpus for surah ${SURAH}. Run \`make compile-corpus\` — these tests ` +
        `run against the real corpus on purpose.`,
    );
  }
  corpus = JSON.parse(readFileSync(path, "utf8")) as Corpus;
  resetApiFetchForTests();
  resetTokenForTests();
  const m = await import("@/lib/corpus/client");
  m.__resetCorpusCache();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  const m = await import("@/lib/corpus/client");
  m.__resetCorpusCache();
});

const MARKER = "TEST_OVERRIDE_GLOSS_MARKER";

function installFetch(overrides: unknown[]): { calls: string[] } {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = String(url);
      calls.push(path);
      if (path.startsWith("/corpus/")) {
        return { ok: true, json: async () => corpus } as Response;
      }
      if (path.includes("/api/overrides")) {
        return new Response(JSON.stringify({ overrides }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    }),
  );
  return { calls };
}

describe("fetchCorpus applies overrides — the unwired read half of the override layer", () => {
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

    const { fetchCorpus } = await import("@/lib/corpus/client");
    const patched = await fetchCorpus(SURAH);
    expect(patched).not.toBeNull();
    const word = patched!.words.find((w) => w.ayah === 1 && w.position === 1);
    expect(word?.gloss.en).toBe(MARKER);
  });

  it("calls GET /api/overrides for the requested surah", async () => {
    const { calls } = installFetch([]);
    const { fetchCorpus } = await import("@/lib/corpus/client");
    await fetchCorpus(SURAH);
    expect(
      calls.some((c) => c.includes("/api/overrides") && c.includes(`surah=${SURAH}`)),
    ).toBe(true);
  });

  it("degrades to the raw corpus when the overrides fetch fails — never blocks a session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const path = String(url);
        if (path.startsWith("/corpus/")) {
          return { ok: true, json: async () => corpus } as Response;
        }
        return new Response("server error", { status: 500 });
      }),
    );
    const { fetchCorpus } = await import("@/lib/corpus/client");
    const patched = await fetchCorpus(SURAH);
    expect(patched).not.toBeNull();
    expect(patched!.words.length).toBe(corpus.words.length);
  });

  it("DISCARDS nothing a caller needs — `fetchEffectiveCorpus` surfaces the disabled list too", async () => {
    // `applyOverrides` returns {corpus, disabled, groups}; `fetchCorpus` took
    // only `.corpus`, so the `disable` field — a real, admin-writable,
    // Laravel-validated override kind (`OverridesController::CLOSED_FIELDS`)
    // — reached no caller anywhere and `isQuestionDisabled()` had zero
    // production callers. This is the read side of that gap.
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

    const { fetchEffectiveCorpus } = await import("@/lib/corpus/client");
    const effective = await fetchEffectiveCorpus(SURAH);
    expect(effective).not.toBeNull();
    expect(effective!.disabled).toEqual([{ ayah: 2, position: null, questionType: "locate" }]);
  });

  it("a later re-enabling row (disabled:false) leaves the list empty", async () => {
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
      {
        id: 2,
        surah: SURAH,
        ayah: 2,
        position: null,
        questionType: "locate",
        field: "disable",
        payload: { disabled: false },
        editorId: null,
        note: null,
        createdAt: 2,
      },
    ]);
    const { fetchEffectiveCorpus } = await import("@/lib/corpus/client");
    const effective = await fetchEffectiveCorpus(SURAH);
    expect(effective!.disabled).toEqual([]);
  });

  it("degrades to an EMPTY disabled list when the overrides fetch fails — never blocks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const path = String(url);
        if (path.startsWith("/corpus/")) {
          return { ok: true, json: async () => corpus } as Response;
        }
        return new Response("server error", { status: 500 });
      }),
    );
    const { fetchEffectiveCorpus } = await import("@/lib/corpus/client");
    const effective = await fetchEffectiveCorpus(SURAH);
    expect(effective).not.toBeNull();
    expect(effective!.disabled).toEqual([]);
    expect(effective!.corpus.words.length).toBe(corpus.words.length);
  });

  it("`fetchCorpus` still returns exactly the patched corpus — existing callers unchanged", async () => {
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
    const { fetchCorpus, fetchEffectiveCorpus } = await import("@/lib/corpus/client");
    const viaCorpus = await fetchCorpus(SURAH);
    const viaEffective = await fetchEffectiveCorpus(SURAH);
    // Content equality, not object identity: each call re-applies overrides
    // against the cached RAW corpus (see the cache-staleness describe block
    // below), so two independent calls now produce two distinct
    // override-patched objects with the same content, by design.
    expect(viaCorpus).toEqual(viaEffective!.corpus);
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
    const { fetchCorpus } = await import("@/lib/corpus/client");
    const patched = await fetchCorpus(SURAH);
    const other = patched!.words.find((w) => w.ayah === 1 && w.position === 2);
    const originalOther = corpus.words.find((w) => w.ayah === 1 && w.position === 2);
    expect(other?.gloss.en).toBe(originalOther?.gloss.en);
  });
});

describe("fetchEffectiveCorpus's module-level cache does not stale the OVERRIDE half", () => {
  // The module header justifies caching on "the corpus is static
  // content-addressed data" — true of the raw bytes, never claimed of
  // overrides. `SessionIsland` calls `fetchCorpus` fresh on every session
  // start (not once per page load), so two session starts for the same
  // surah in one tab — the ordinary case, no full reload in between — must
  // not let the second one serve the first's stale `disabled`/patched gloss
  // forever. This is the exact defect this file's own header names
  // ("a qari/admin correction... never reached anyone actually being
  // graded"), reopened one layer up by the cache.
  it("a later override reaches the NEXT call for the same surah, not just the next tab", async () => {
    let overridesNow: unknown[] = [];
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const path = String(url);
        calls.push(path);
        if (path.startsWith("/corpus/")) {
          return { ok: true, json: async () => corpus } as Response;
        }
        if (path.includes("/api/overrides")) {
          return new Response(JSON.stringify({ overrides: overridesNow }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response("{}", { status: 200 });
      }),
    );

    const { fetchEffectiveCorpus } = await import("@/lib/corpus/client");

    const first = await fetchEffectiveCorpus(SURAH);
    expect(first!.disabled).toEqual([]);

    // An admin disables ayah 2's `locate` question between the two calls —
    // no cache reset, exactly as a learner's tab would see it.
    overridesNow = [
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
    ];

    const second = await fetchEffectiveCorpus(SURAH);
    expect(second!.disabled).toEqual([{ ayah: 2, position: null, questionType: "locate" }]);

    // The raw corpus bytes ARE still the thing worth caching — only one
    // fetch of the 16KB asset across both calls.
    expect(calls.filter((c) => c.startsWith("/corpus/")).length).toBe(1);
    expect(calls.filter((c) => c.includes("/api/overrides")).length).toBe(2);
  });

  it("a later re-ENABLE also reaches the next call, not just a later tab", async () => {
    let overridesNow: unknown[] = [
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
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const path = String(url);
        if (path.startsWith("/corpus/")) {
          return { ok: true, json: async () => corpus } as Response;
        }
        if (path.includes("/api/overrides")) {
          return new Response(JSON.stringify({ overrides: overridesNow }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response("{}", { status: 200 });
      }),
    );

    const { fetchCorpus } = await import("@/lib/corpus/client");

    const first = await fetchCorpus(SURAH);
    const firstWord = first!.words.find((w) => w.ayah === 1 && w.position === 1);
    expect(firstWord?.gloss.en).toBe(MARKER);

    // The qari reverts the correction before the next session starts.
    overridesNow = [];

    const second = await fetchCorpus(SURAH);
    const secondWord = second!.words.find((w) => w.ayah === 1 && w.position === 1);
    expect(secondWord?.gloss.en).toBe(
      corpus.words.find((w) => w.ayah === 1 && w.position === 1)?.gloss.en,
    );
  });
});
