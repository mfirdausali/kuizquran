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
