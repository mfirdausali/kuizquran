/**
 * @vitest-environment jsdom
 */

// BUILD-PLAN STEP 22 — onboarding (WIREFRAME §17).
//
// ---------------------------------------------------------------------------
// WHAT THESE TESTS ARE FOR, AND WHAT THEY REFUSE TO DO
// ---------------------------------------------------------------------------
// The crux of step 22 is screen 2: a live tap-to-reconstruct of Al-Ikhlas 112:1
// that must use the REAL corpus and the REAL quiz components. So these tests
// drive the real `reconstruct.ts` state machine against the REAL compiled 112
// corpus, and assert on what a learner would actually see and tap.
//
// NOT ONE ARABIC BYTE IS TYPED HERE. Every glyph these assertions touch is
// resolved from the corpus through `buildFace` at runtime — the same rule that
// holds in the app (`check-boundaries.mjs` clause 4) holding in the tests.
// Where a test needs "the correct word", it asks the ENGINE for it rather than
// spelling it.
//
// THE CORPUS IS READ FROM THE STAGED ASSET, not from a hand-made fixture. A
// fixture would keep these tests green after the real corpus drifted, which is
// the one failure a corpus-backed test exists to catch. If `public/corpus/`
// has not been staged, the tests say so rather than silently passing on a
// fabrication.

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";

import type { Corpus } from "@engine/types.ts";
import { initReconstruct, advanceReconstruct } from "@engine/reconstruct.ts";
import { resolveRef } from "@engine/corpusRef.ts";
import { ayahWords } from "@engine/corpus.ts";
import { paceConfig } from "@engine/pace.ts";

import { assemblePass, displayOrder, filledSoFar } from "@/lib/onboarding/pass";
import { OFFERED_SURAHS, DEFAULT_SURAH, WIREFRAME_DEFAULT_SURAH } from "@/lib/onboarding/surahs";
import { defaultGlossLang } from "@/lib/onboarding/choices";
import { CLIENT_SURAHS, DEMO_AYAH, DEMO_SURAH } from "@/lib/corpus/client";
import { FirstRecall } from "@/components/onboarding/FirstRecall";

afterEach(cleanup);

const HERE = dirname(fileURLToPath(import.meta.url));
const STAGED = resolve(HERE, "../public/corpus/112.json");
const COMPILED = resolve(HERE, "../../../packages/corpus-compiler/output/112/corpus.json");

let corpus: Corpus;

beforeAll(() => {
  // The staged asset is what the browser actually fetches; the compiled output
  // is its source. Prefer the staged one — testing what ships — and fall back
  // so a checkout that ran `make compile-corpus` but not the stage step still
  // runs these tests rather than skipping them silently.
  const path = existsSync(STAGED) ? STAGED : COMPILED;
  if (!existsSync(path)) {
    throw new Error(
      `No 112 corpus at ${STAGED} or ${COMPILED}. Run \`make compile-corpus\` ` +
        `then \`npm run stage-corpus\` — output/ is gitignored (v3-D52).`,
    );
  }
  corpus = JSON.parse(readFileSync(path, "utf8")) as Corpus;
});

// ---------------------------------------------------------------------------
// THE CORPUS SCREEN 2 DEPENDS ON
// ---------------------------------------------------------------------------
describe("the 112 corpus screen 2 runs on", () => {
  it("has all four ayat and fifteen words", () => {
    expect(corpus.meta.surah).toBe(112);
    expect(corpus.verses).toHaveLength(4);
    expect(corpus.words).toHaveLength(15);
  });

  it("yields a FULL option bank for every word of 112:1 — the claim screen 2 rests on", () => {
    // The brief states 112 now has generated distractors and that every word
    // returns a full tile bank. That is the precondition for screen 2 being
    // buildable at all, so it is asserted rather than assumed: a corpus
    // regression that emptied the distractor table would otherwise show up as
    // a one-tile bank in front of a learner.
    const state = initReconstruct(corpus, DEMO_SURAH, DEMO_AYAH, 0, { full: true });
    expect(state.blankPositions.length).toBe(ayahWords(corpus, DEMO_AYAH).length);

    let cursor = state;
    let blanks = 0;
    while (true) {
      const assembled = assemblePass(cursor, corpus);
      if (!assembled) break;
      // Learn band = 4 options (options.ts). A bank of 1 means "no distractors
      // exist", which is what this corpus previously had.
      expect(assembled.item.options.length).toBe(4);
      blanks++;
      const advanced = advanceReconstruct(cursor, corpus, assembled.correctSurface);
      expect(advanced.correct).toBe(true);
      cursor = advanced.state;
    }
    expect(blanks).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// PASS ASSEMBLY — the seam between the engine and the real quiz components
// ---------------------------------------------------------------------------
describe("assemblePass", () => {
  it("gives every option MANDATORY, RESOLVING provenance", () => {
    // The sacred-text guarantee, asserted rather than trusted: a Face's `from`
    // must resolve back to its own `text`. This is what makes hand-typed Arabic
    // structurally unreachable — if assembly ever put a bare string into a
    // Face, this fails.
    for (const ayah of corpus.verses.map((v) => v.ayah)) {
      let state = initReconstruct(corpus, DEMO_SURAH, ayah, 0, { full: true });
      while (true) {
        const assembled = assemblePass(state, corpus);
        if (!assembled) break;
        for (const option of assembled.item.options) {
          expect(resolveRef(corpus, option.from)).toBe(option.text);
        }
        for (const word of assembled.item.ayahWords) {
          expect(resolveRef(corpus, word.from)).toBe(word.text);
        }
        state = advanceReconstruct(state, corpus, assembled.correctSurface).state;
      }
    }
  });

  it("points correctIndex at the option the ENGINE accepts, after shuffling", () => {
    // The off-by-inversion this is written against: `order.indexOf(correct)` vs
    // `order[correct]`. Both produce a plausible index; only one marks the tile
    // the learner must actually tap. Asserted by round-tripping the Face at
    // correctIndex back through the engine's own grader.
    let state = initReconstruct(corpus, DEMO_SURAH, DEMO_AYAH, 0, { full: true });
    while (true) {
      const assembled = assemblePass(state, corpus);
      if (!assembled) break;
      const marked = assembled.item.options[assembled.item.correctIndex]!;
      const advanced = advanceReconstruct(state, corpus, marked.text);
      expect(advanced.correct).toBe(true);
      state = advanced.state;
    }
  });

  it("does NOT leave the correct answer at index 0 for every blank", () => {
    // `reconstruct.ts` returns [correct, ...distractors]. Painting that order
    // makes the drill tappable without reading: first tile, every time. If the
    // shuffle were dropped, this array would be all zeros.
    const slots: number[] = [];
    for (const ayah of corpus.verses.map((v) => v.ayah)) {
      let state = initReconstruct(corpus, DEMO_SURAH, ayah, 0, { full: true });
      while (true) {
        const assembled = assemblePass(state, corpus);
        if (!assembled) break;
        slots.push(assembled.item.correctIndex);
        state = advanceReconstruct(state, corpus, assembled.correctSurface).state;
      }
    }
    expect(slots.length).toBe(15);
    expect(new Set(slots).size).toBeGreaterThan(1);
  });

  it("is deterministic — the same blank assembles the same bank twice", () => {
    // A bank that reshuffles between renders moves a tile under the learner's
    // finger. The seed is the coordinate, so the order is a property of WHICH
    // BLANK, never of when it was rendered.
    const state = initReconstruct(corpus, DEMO_SURAH, DEMO_AYAH, 0, { full: true });
    const a = assemblePass(state, corpus)!;
    const b = assemblePass(state, corpus)!;
    expect(a.item.options.map((o) => o.text)).toEqual(b.item.options.map((o) => o.text));
    expect(a.item.correctIndex).toBe(b.item.correctIndex);
  });

  it("maps blank word POSITIONS to ayahWords INDICES, never assuming position-1", () => {
    const state = initReconstruct(corpus, DEMO_SURAH, DEMO_AYAH, 0, { full: true });
    const assembled = assemblePass(state, corpus)!;
    const words = ayahWords(corpus, DEMO_AYAH);
    // Every render-contract blank index must address a real word slot.
    for (const index of assembled.item.blankPositions) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(words.length);
    }
    expect(assembled.item.ayahWords).toHaveLength(words.length);
  });

  it("filledSoFar reports exactly the blanks already produced", () => {
    let state = initReconstruct(corpus, DEMO_SURAH, DEMO_AYAH, 0, { full: true });
    expect(filledSoFar(state).size).toBe(0);
    let expected = 0;
    while (true) {
      const assembled = assemblePass(state, corpus);
      if (!assembled) break;
      state = advanceReconstruct(state, corpus, assembled.correctSurface).state;
      expected++;
      expect(filledSoFar(state).size).toBe(expected);
    }
  });
});

describe("displayOrder", () => {
  it("is a permutation — every option appears exactly once", () => {
    // A shuffle that dropped or duplicated an index would silently remove the
    // correct answer from a bank, which is unanswerable rather than merely
    // wrong.
    for (let n = 1; n <= 8; n++) {
      for (let seed = 0; seed < 40; seed++) {
        const order = displayOrder(n, seed);
        expect([...order].sort((a, b) => a - b)).toEqual(
          Array.from({ length: n }, (_, i) => i),
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// SCREEN 2 — the three passes, as WIREFRAME §17 specifies them
// ---------------------------------------------------------------------------
describe("screen 2 — first recall", () => {
  // The component fetches the corpus. Serve the REAL staged bytes rather than a
  // stub: the point of this screen is that it runs on the real corpus.
  function stubFetch() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => corpus })),
    );
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    // The client loader memoises per module instance; clear it so one test's
    // corpus cannot satisfy the next test's fetch assertion.
    void import("@/lib/corpus/client").then((m) => m.__resetCorpusCache());
  });

  it("PASS 1 SHOWS the ayah and asks for no recall — §17's stated mitigation", async () => {
    stubFetch();
    render(<FirstRecall />);

    // The full verse is painted, from the corpus, before anything is asked.
    const verse = resolveRef(corpus, { kind: "verse", ayah: DEMO_AYAH }) as string;
    await waitFor(() => expect(screen.getByText(verse)).toBeTruthy());

    // And there is NOTHING to answer: no tile bank exists on pass 1. This is
    // the whole mitigation — "nobody is tested on something they were never
    // shown" — so it is asserted as an ABSENCE, which is the only way to
    // express it.
    expect(screen.queryByRole("group", { name: /word choices/i })).toBeNull();
  });

  it("only reaches a recall pass AFTER the learner acknowledges the shown ayah", async () => {
    stubFetch();
    render(<FirstRecall />);
    const verse = resolveRef(corpus, { kind: "verse", ayah: DEMO_AYAH }) as string;
    await waitFor(() => expect(screen.getByText(verse)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /read it/i }));

    // Now, and only now, a bank exists.
    await waitFor(() =>
      expect(screen.getByRole("group", { name: /word choices/i })).toBeTruthy(),
    );
  });

  it("PASS 2 hides exactly one word — the gentlest first recall", async () => {
    stubFetch();
    render(<FirstRecall />);
    const verse = resolveRef(corpus, { kind: "verse", ayah: DEMO_AYAH }) as string;
    await waitFor(() => expect(screen.getByText(verse)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /read it/i }));

    await waitFor(() => expect(document.querySelectorAll(".gap-slot").length).toBe(1));
  });

  it("reaches the WHOLE-ayah pass, and blanks every word in it", async () => {
    stubFetch();
    render(<FirstRecall />);
    const verse = resolveRef(corpus, { kind: "verse", ayah: DEMO_AYAH }) as string;
    await waitFor(() => expect(screen.getByText(verse)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /read it/i }));
    await waitFor(() => expect(document.querySelectorAll(".gap-slot").length).toBe(1));

    // Answer pass 2's single blank correctly, by asking the ENGINE which tile
    // is right rather than by spelling a word here.
    await tapCorrect();

    // Pass 3 blanks the whole ayah.
    const words = ayahWords(corpus, DEMO_AYAH).length;
    await waitFor(() => expect(document.querySelectorAll(".gap-slot").length).toBe(words));
  });

  it("a whole blind reconstruction reaches the done state — the promise §17 makes", async () => {
    stubFetch();
    render(<FirstRecall />);
    const verse = resolveRef(corpus, { kind: "verse", ayah: DEMO_AYAH }) as string;
    await waitFor(() => expect(screen.getByText(verse)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /read it/i }));
    await waitFor(() => expect(document.querySelectorAll(".gap-slot").length).toBe(1));

    // pass 2 (1 blank) + pass 3 (every word)
    const total = 1 + ayahWords(corpus, DEMO_AYAH).length;
    for (let i = 0; i < total; i++) await tapCorrect();

    await waitFor(() =>
      expect(screen.getByText(/rebuilt it from nothing/i)).toBeTruthy(),
    );
  });

  it("a WRONG tap does not advance the blank — a slip is not a failure", async () => {
    stubFetch();
    render(<FirstRecall />);
    const verse = resolveRef(corpus, { kind: "verse", ayah: DEMO_AYAH }) as string;
    await waitFor(() => expect(screen.getByText(verse)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /read it/i }));
    await waitFor(() => expect(document.querySelectorAll(".gap-slot").length).toBe(1));

    const before = document.querySelectorAll(".gap-slot.is-filled").length;
    tapWrong();

    // The reveal appears and offers a way back to the SAME blank.
    await waitFor(() => expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy());
    expect(document.querySelectorAll(".gap-slot.is-filled").length).toBe(before);
  });

  it("renders the corpus-unavailable state rather than inventing an ayah (#91)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    render(<FirstRecall />);
    await waitFor(() => expect(screen.getByText(/connect once to begin/i)).toBeTruthy());
    // And no Arabic is painted at all — there is no fallback text.
    expect(document.querySelector(".ayah")).toBeNull();
  });

  /** Tap the tile the ENGINE says is correct. Finds it by matching the rendered
   *  tile text against the corpus-resolved answer — never by spelling a word in
   *  this file, and never by assuming a tile position. */
  async function tapCorrect() {
    const bank = await screen.findByRole("group", { name: /word choices/i });
    const buttons = [...bank.querySelectorAll("button")];
    // The active blank's expected surface, from the corpus.
    const slot = document.querySelector(".gap-slot.is-current");
    const blankIndex = Number(slot?.getAttribute("data-blank-index") ?? "0");
    const filledCount = document.querySelectorAll(".gap-slot.is-filled").length;
    const blanks = [...document.querySelectorAll(".gap-slot")];
    void blankIndex;
    void filledCount;
    void blanks;
    // Recompute the engine's own expectation for the current blank by replaying
    // the same construction the component uses.
    const words = ayahWords(corpus, DEMO_AYAH);
    const whole = document.querySelectorAll(".gap-slot").length === words.length;
    let state = initReconstruct(corpus, DEMO_SURAH, DEMO_AYAH, 0, whole ? { full: true } : undefined);
    const already = document.querySelectorAll(".gap-slot.is-filled").length;
    for (let i = 0; i < already; i++) {
      const a = assemblePass(state, corpus)!;
      state = advanceReconstruct(state, corpus, a.correctSurface).state;
    }
    const expected = assemblePass(state, corpus)!.correctSurface;
    const target = buttons.find((b) => b.textContent === expected);
    expect(target).toBeTruthy();
    fireEvent.click(target!);
  }

  /** Tap any tile that is NOT the correct one. */
  function tapWrong() {
    const bank = document.querySelector('[role="group"][aria-label="Word choices"]')!;
    const buttons = [...bank.querySelectorAll("button")];
    const words = ayahWords(corpus, DEMO_AYAH);
    const whole = document.querySelectorAll(".gap-slot").length === words.length;
    const state = initReconstruct(corpus, DEMO_SURAH, DEMO_AYAH, 0, whole ? { full: true } : undefined);
    const expected = assemblePass(state, corpus)!.correctSurface;
    const wrong = buttons.find((b) => b.textContent !== expected);
    expect(wrong).toBeTruthy();
    fireEvent.click(wrong!);
  }
});

// ---------------------------------------------------------------------------
// WHAT ONBOARDING OFFERS — honesty against the compiled corpus
// ---------------------------------------------------------------------------
describe("screen 5 — the surahs actually offered", () => {
  it("offers only surahs this build has compiled", () => {
    // The failure this prevents: enrolling a learner in a surah with no corpus,
    // which finishes onboarding and lands them on a dashboard with nothing to
    // do. Read the real manifest rather than restating it.
    const manifestPath = resolve(
      HERE,
      "../../../packages/corpus-compiler/output/manifest.json",
    );
    if (!existsSync(manifestPath)) return; // gitignored; nothing to compare against
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      surahs: Record<string, { ayahCount: number }>;
    };
    for (const offered of OFFERED_SURAHS) {
      const entry = manifest.surahs[String(offered.surah)];
      expect(entry, `surah ${offered.surah} is offered but not compiled`).toBeTruthy();
      // And the ayah count shown to the learner must be the real one.
      expect(entry!.ayahCount).toBe(offered.ayahCount);
    }
  });

  it("does NOT offer the wireframe's default, because it is not compiled", () => {
    // §17 names Al-Mulk. This asserts the DIVERGENCE is deliberate and stays
    // visible: the day 67 compiles, this test fails and someone must decide to
    // offer it — which is exactly the review moment that should happen.
    const manifestPath = resolve(
      HERE,
      "../../../packages/corpus-compiler/output/manifest.json",
    );
    if (!existsSync(manifestPath)) return;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      surahs: Record<string, unknown>;
    };
    const compiled = Object.hasOwn(manifest.surahs, String(WIREFRAME_DEFAULT_SURAH));
    const offered = OFFERED_SURAHS.some((s) => s.surah === WIREFRAME_DEFAULT_SURAH);
    expect(offered).toBe(compiled);
  });

  it("the default is one of the offered surahs", () => {
    expect(OFFERED_SURAHS.some((s) => s.surah === DEFAULT_SURAH)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// THE CLIENT CORPUS LOADER
// ---------------------------------------------------------------------------
// These tests exist because a MUTATION SURVIVED. Deleting the `res.ok` check
// from `fetchCorpus` left all 24 tests green: the component-level #91 test
// stubs a 404 whose body is `{}`, and the `usable()` shape guard rejects `{}`
// on its own — so the status check was never the thing being asserted.
//
// That gap is not theoretical. A misconfigured host, an SPA history fallback,
// or a caching proxy can answer a 404 with a WELL-FORMED body; the shape guard
// would pass it and the app would reconstruct from whatever that body held. The
// status check is the only thing standing between a learner and an ayah served
// by an error page, so it gets its own assertion rather than borrowing one.
describe("fetchCorpus", () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    const m = await import("@/lib/corpus/client");
    m.__resetCorpusCache();
  });

  it("REFUSES a non-OK response even when the body is a VALID corpus", async () => {
    // The mutation that survived, now killed: `ok: false` with a real corpus
    // body. Only the status check can reject this.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => corpus })),
    );
    const { fetchCorpus, __resetCorpusCache } = await import("@/lib/corpus/client");
    __resetCorpusCache();
    expect(await fetchCorpus(DEMO_SURAH)).toBeNull();
  });

  it("refuses a 200 whose body is not a usable corpus", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ verses: [], words: [] }) })),
    );
    const { fetchCorpus, __resetCorpusCache } = await import("@/lib/corpus/client");
    __resetCorpusCache();
    expect(await fetchCorpus(DEMO_SURAH)).toBeNull();
  });

  it("returns null for a surah this build does not stage, without fetching", async () => {
    const spy = vi.fn(async () => ({ ok: true, json: async () => corpus }));
    vi.stubGlobal("fetch", spy);
    const { fetchCorpus, __resetCorpusCache } = await import("@/lib/corpus/client");
    __resetCorpusCache();
    // Surah 12 is deliberately server-only — 3.4 MB must never reach a browser.
    expect(await fetchCorpus(12)).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns null when the network throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const { fetchCorpus, __resetCorpusCache } = await import("@/lib/corpus/client");
    __resetCorpusCache();
    expect(await fetchCorpus(DEMO_SURAH)).toBeNull();
  });

  it("serves the real corpus on a 200, and caches it", async () => {
    const spy = vi.fn(async () => ({ ok: true, json: async () => corpus }));
    vi.stubGlobal("fetch", spy);
    const { fetchCorpus, __resetCorpusCache } = await import("@/lib/corpus/client");
    __resetCorpusCache();
    const first = await fetchCorpus(DEMO_SURAH);
    expect(first?.meta.surah).toBe(112);
    await fetchCorpus(DEMO_SURAH);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("the corpus staging contract", () => {
  it("the client surah list matches what the staging script stages", () => {
    // Two files name the same decision (the loader's CLIENT_SURAHS and the
    // script's). A surah added to one and not the other is a 404 at runtime, in
    // front of a learner, on the most important screen in the product.
    const scriptSrc = readFileSync(resolve(HERE, "../scripts/stage-corpus.mjs"), "utf8");
    const match = scriptSrc.match(/const CLIENT_SURAHS = \[([^\]]*)\]/);
    expect(match).toBeTruthy();
    const staged = match![1]!
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    expect([...staged].sort()).toEqual([...CLIENT_SURAHS].sort());
  });

  it("112 is the demo surah and is staged for the client", () => {
    expect(DEMO_SURAH).toBe(112);
    expect(CLIENT_SURAHS).toContain(DEMO_SURAH);
  });
});

// ---------------------------------------------------------------------------
// WHAT ONBOARDING CAPTURES — §17's "nothing else"
// ---------------------------------------------------------------------------
describe("screen 6 — pace", () => {
  it("shows the ENGINE's own budget and ceiling, never a restated copy", () => {
    // The failure: a screen promising "8 minutes a day" that keeps promising it
    // after the engine's budget changes. Every number on screen 6 is read from
    // paceConfig, so this test asserts the values exist to be read.
    for (const mode of ["steady", "sprint", "maintain"] as const) {
      const cfg = paceConfig(mode);
      expect(typeof cfg.budgetMin).toBe("number");
      expect(typeof cfg.newAyahCeiling).toBe("number");
    }
    // Maintain takes on nothing new — the screen says so, and it is the
    // engine's fact, not the copy's.
    expect(paceConfig("maintain").newAyahCeiling).toBe(0);
  });
});

describe("gloss language default", () => {
  it("falls back to EN when the device locale is neither", () => {
    vi.stubGlobal("navigator", { languages: ["fr-FR"], language: "fr-FR" });
    expect(defaultGlossLang()).toBe("en");
    vi.unstubAllGlobals();
  });

  it("defaults to MS for a Malay device", () => {
    vi.stubGlobal("navigator", { languages: ["ms-MY"], language: "ms-MY" });
    expect(defaultGlossLang()).toBe("ms");
    vi.unstubAllGlobals();
  });
});
