/**
 * @vitest-environment jsdom
 */

// THE INLINE DEMO — WIREFRAME §18 §2 / §17 screen 2.
//
//     "A fully working tap-to-reconstruct of Al-Ikhlas 112:1, inline, no
//      install."
//
// ---------------------------------------------------------------------------
// THESE TESTS RUN AGAINST THE REAL COMPILED CORPUS, NOT A FIXTURE OF MY OWN
// ---------------------------------------------------------------------------
// The corpus is read from `packages/corpus-compiler/output/112/corpus.json` —
// the same artifact `scripts/stage-corpus.mjs` copies into `public/corpus/`
// and the same one the browser fetches. A hand-built stub would test the demo
// against a fiction: it would keep passing after the compiler's output shape
// changed, and it could not have detected the state this build was in until
// recently, when surah 112 had ZERO distractors and every bank collapsed to a
// single option (v3-D51).
//
// That last point is why the "full bank" assertion below is not decoration.
// With no distractors, `pickOptions` returns `{correct, distractors: []}` and
// the drill still RENDERS — one tile, guaranteed correct. It would look
// finished and be worthless, and no structural test would notice. So the
// arity of every bank is asserted explicitly, for every blank in the pass.
//
// v3-D52: `output/` is GITIGNORED. A clean checkout that has not run
// `make compile-corpus` has no corpus at all, and these tests SKIP rather than
// fail — with the reason printed, so "the demo tests didn't run" is never
// silent. A hard failure would make a fresh clone un-testable for a missing
// build artifact; a silent pass would be a vacuous verification. Skipping
// loudly is the only honest third option.
//
// NOT ONE ARABIC BYTE IS TYPED HERE. Every glyph these assertions see arrives
// at runtime from the corpus through `buildFace`, exactly as in the app
// (check-boundaries clause 4). The tests reference COORDINATES.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Corpus } from "@engine/types.ts";
import { ayahWords } from "@engine/corpus.ts";
import {
  applyTap,
  demoCaption,
  startDemo,
  stepOf,
  DEMO_AYAH,
  DEMO_STRENGTH,
  DEMO_SURAH,
} from "../lib/demo/reconstruct";
import { InlineDemo } from "../components/demo/InlineDemo";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS_PATH = resolve(
  HERE,
  "../../../packages/corpus-compiler/output/112/corpus.json",
);

const corpusAvailable = existsSync(CORPUS_PATH);
const corpus: Corpus | null = corpusAvailable
  ? (JSON.parse(readFileSync(CORPUS_PATH, "utf8")) as Corpus)
  : null;

if (!corpusAvailable) {
  console.warn(
    `\n⚠  landing-demo tests SKIPPED — no compiled corpus at ${CORPUS_PATH}.\n` +
      `   output/ is gitignored (v3-D52). Run \`make compile-corpus\`.\n`,
  );
}

/** Guarded accessor. Every test below runs only when the corpus is present. */
const describeWithCorpus = corpusAvailable ? describe : describe.skip;
const C = () => corpus as Corpus;

afterEach(() => cleanup());

describeWithCorpus("the demo drives the REAL engine over the REAL corpus", () => {
  it("112:1 exists and the demo blanks every one of its words", () => {
    const started = startDemo(C());
    expect("state" in started, "112:1 must be drillable").toBe(true);
    if (!("state" in started)) return;

    const words = ayahWords(C(), DEMO_AYAH);
    expect(words.length).toBeGreaterThan(0);
    // `full: true` — the cold-gate construction. Every word hidden, which is
    // the "fully working" in §18's "fully working tap-to-reconstruct". At the
    // Learn-band default this would be ONE blank, and the demo would be a
    // single tap that undersells the whole mechanic.
    expect(started.state.machine.blankPositions.length).toBe(words.length);
  });

  it("EVERY blank offers a FULL option bank — never a one-option non-choice", () => {
    // v3-D51's exact failure mode. With zero distractors the drill renders,
    // looks complete, and is worthless: one tile, guaranteed correct.
    const started = startDemo(C());
    if (!("state" in started)) throw new Error("112:1 not drillable");
    let s = started.state;

    const bankSizes: number[] = [];
    let guard = 0;
    while (!s.done && guard++ < 50) {
      const step = stepOf(s, C());
      if (!step) break;
      bankSizes.push(step.item.options.length);
      // Tap the correct option, whichever index the engine put it at.
      s = applyTap(s, C(), step.item.correctIndex);
    }

    expect(bankSizes.length).toBeGreaterThan(0);
    // `options(strength)` at DEMO_STRENGTH (0, Learn band) specifies count 4.
    expect(DEMO_STRENGTH).toBeLessThan(40);
    for (const size of bankSizes) {
      expect(size, "a bank smaller than 4 means missing distractors (v3-D51)").toBe(4);
    }
  });

  it("a correct tap advances; the pass completes and reports done", () => {
    const started = startDemo(C());
    if (!("state" in started)) throw new Error("112:1 not drillable");
    let s = started.state;
    const total = s.machine.blankPositions.length;

    for (let i = 0; i < total; i++) {
      const step = stepOf(s, C());
      expect(step, `blank ${i + 1} of ${total} should exist`).not.toBeNull();
      if (!step) return;
      expect(step.blankNumber).toBe(i + 1);
      expect(step.blankTotal).toBe(total);
      s = applyTap(s, C(), step.item.correctIndex);
      expect(s.lastTap?.correct).toBe(true);
    }

    expect(s.done).toBe(true);
    expect(s.slips).toBe(0);
    expect(s.filledPositions.length).toBe(total);
    expect(stepOf(s, C()), "no current blank once the pass is produced").toBeNull();
  });

  it("a WRONG tap does not advance — the demo cannot be tapped through blindly", () => {
    const started = startDemo(C());
    if (!("state" in started)) throw new Error("112:1 not drillable");
    const s0 = started.state;
    const step = stepOf(s0, C());
    if (!step) throw new Error("no first blank");

    // Any index that is not the correct one.
    const wrong = step.item.options.findIndex((_, i) => i !== step.item.correctIndex);
    expect(wrong).toBeGreaterThanOrEqual(0);

    const s1 = applyTap(s0, C(), wrong);
    expect(s1.lastTap).toEqual({ index: wrong, correct: false });
    expect(s1.slips).toBe(1);
    expect(s1.done).toBe(false);
    // Same blank, still. This is what makes the demo a real retrieval rather
    // than a progress bar that fills on any input.
    expect(s1.machine.blankIndex).toBe(s0.machine.blankIndex);
    expect(s1.filledPositions.length).toBe(0);
    expect(stepOf(s1, C())?.blankNumber).toBe(1);
  });

  it("every Face carries corpus provenance — no Face is minted from a string", () => {
    // `buildFace` is the ONLY Face constructor and it resolves a CorpusRef, so
    // `from` is mandatory and `text` is bytes that were already in the corpus.
    // Asserting `from` is present on every rendered Face is asserting that the
    // sacred-text guarantee held through this module's assembly.
    const started = startDemo(C());
    if (!("state" in started)) throw new Error("112:1 not drillable");
    const step = stepOf(started.state, C());
    if (!step) throw new Error("no first blank");

    for (const word of step.item.ayahWords) {
      expect(word.from).toBeDefined();
      expect(word.script).toBe("arabic");
    }
    for (const option of step.item.options) {
      expect(option.from).toBeDefined();
      expect(["word", "distractor"]).toContain(option.from.kind);
    }
    // The correct option's provenance is the WORD at this position — not a
    // distractor row that happens to hold the same surface.
    expect(step.item.options[step.item.correctIndex]?.from.kind).toBe("word");
  });

  it("the demo writes NOTHING — no log module is reachable from lib/demo", () => {
    // The pre-recall guarantee's other half. Gate clause 8 covers the markup;
    // this covers the writes. A landing page that appended a fabricated 'first
    // recall' would corrupt the one thing that is supposed to be the truth.
    const src = readFileSync(resolve(HERE, "../lib/demo/reconstruct.ts"), "utf8");
    const loader = readFileSync(resolve(HERE, "../lib/demo/loadClientCorpus.ts"), "utf8");
    for (const [name, text] of [
      ["reconstruct.ts", src],
      ["loadClientCorpus.ts", loader],
    ] as const) {
      const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(code, `${name} must not import the log`).not.toMatch(/from\s+["'][^"']*lib\/idb/);
      expect(code, `${name} must not import sync`).not.toMatch(/from\s+["'][^"']*lib\/sync/);
      expect(code, `${name} must not append events`).not.toMatch(/\bappendEvent\b/);
    }
  });
});

describeWithCorpus("the demo's captions never overclaim (v3-D19 / §21)", () => {
  it("the completion line describes what the visitor DID, not what they now have", () => {
    const started = startDemo(C());
    if (!("state" in started)) throw new Error("112:1 not drillable");
    let s = started.state;
    let guard = 0;
    while (!s.done && guard++ < 50) {
      const step = stepOf(s, C());
      if (!step) break;
      s = applyTap(s, C(), step.item.correctIndex);
    }
    expect(s.done).toBe(true);

    const caption = demoCaption(s);
    // §21's ladder: tapping from a bank is CUED production. It is not free
    // recall, and it says nothing at all about recitation.
    expect(caption.toLowerCase()).not.toMatch(/memori[sz]ed/);
    expect(caption.toLowerCase()).not.toMatch(/by heart/);
    expect(caption.toLowerCase()).not.toMatch(/tajwid|pronunciation/);
    expect(caption).toMatch(/rebuilt/);
  });

  it("a slip is never punished in words", () => {
    const started = startDemo(C());
    if (!("state" in started)) throw new Error("112:1 not drillable");
    const step = stepOf(started.state, C());
    if (!step) throw new Error("no first blank");
    const wrong = step.item.options.findIndex((_, i) => i !== step.item.correctIndex);
    const slipped = applyTap(started.state, C(), wrong);
    const caption = demoCaption(slipped);
    expect(caption.toLowerCase()).not.toMatch(/wrong|fail|incorrect|bad/);
  });
});

describe("the demo degrades honestly when the corpus is absent (v3-D52)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a designed unavailable state, never a fabricated ayah", async () => {
    // A clean checkout without `make compile-corpus` has no staged corpus.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", { status: 404 })),
    );
    render(<InlineDemo label="Al-Ikhlas, verse 1" />);
    const note = await screen.findByText(/could not load/i);
    expect(note).toBeTruthy();
    // No bank, no tiles — an empty drill would read as a finished one.
    expect(screen.queryByRole("group", { name: /word choices/i })).toBeNull();
  });

  it("an empty-but-parseable corpus is treated as absent, not as an empty ayah", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ words: [], verses: [], distractors: [] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    render(<InlineDemo />);
    expect(await screen.findByText(/could not load/i)).toBeTruthy();
  });
});

describeWithCorpus("the demo renders and is tappable (the §18 conversion engine)", () => {
  it("paints the real bank and the real ayah line from the fetched corpus", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(C()), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    render(<InlineDemo label="Al-Ikhlas, verse 1" />);

    const bank = await screen.findByRole("group", { name: /word choices/i });
    expect(bank).toBeTruthy();
    const tiles = bank.querySelectorAll("button.tile");
    expect(tiles.length, "a full 4-option bank (v3-D51)").toBe(4);

    // The ayah line is an RTL Arabic island — dir and lang carry the MEANING
    // for assistive tech, which reads markup and not CSS (#80).
    const ayah = document.querySelector("p.ayah");
    expect(ayah?.getAttribute("dir")).toBe("rtl");
    expect(ayah?.getAttribute("lang")).toBe("ar");

    // Every blank is a slot; the demo blanks the whole ayah.
    const slots = document.querySelectorAll(".gap-slot");
    expect(slots.length).toBe(ayahWords(C(), DEMO_AYAH).length);

    vi.unstubAllGlobals();
  });

  it("captures NO identity — the pre-recall rule, in the rendered markup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(C()), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    render(<InlineDemo />);
    await screen.findByRole("group", { name: /word choices/i });

    // WIREFRAME §17: "no account, no email, no notification prompt until the
    // learner has produced an ayah from memory." Gate clause 8 enforces this
    // over the SOURCE; this asserts it over what actually rendered.
    expect(document.querySelector('input[type="email"]')).toBeNull();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(document.querySelectorAll("input,form").length).toBe(0);

    vi.unstubAllGlobals();
  });

  it("uses the SAME card the real drill uses, not a landing-page lookalike", () => {
    // §18: "the mechanic sells itself; describing it does not." A mock that
    // merely looked like the drill would rot the moment the real card changed,
    // and would be exactly the dishonesty this section warns against.
    const src = readFileSync(resolve(HERE, "../components/demo/InlineDemo.tsx"), "utf8");
    expect(src).toMatch(/from\s+["']@\/components\/quiz\/SequenceFillCard["']/);
  });

  it("lives in a NEUTRAL directory — it is shared with onboarding screen 2", () => {
    // §17 screen 2 and §18 §2 are the SAME artifact. Two implementations would
    // drift, and would drift invisibly. `components/demo/` belongs to neither
    // surface, which is what stops either from quietly forking it.
    expect(existsSync(resolve(HERE, "../components/demo/InlineDemo.tsx"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// REGRESSION (adversarial review, 2026-08-11): THE DEMO MUST NOT BE TAPPABLE
// WITHOUT READING
// ---------------------------------------------------------------------------
// The engine returns `[correct, ...distractors]` — the correct answer always at
// index 0 — because options.ts states that display order is the UI's concern.
// This file's demo originally painted that order verbatim while onboarding
// screen 2 seed-shuffled it: TWO implementations of the SAME 112:1 drill, drifted.
//
// On the landing page the consequence is the worst available in this product.
// §18 calls the demo "the conversion engine": tapping the first tile four times
// would produce a flawless reconstruction, and the page would then claim the
// visitor had recalled an ayah they never read. A demo that lies about memory
// is worse than no demo.
//
// Both surfaces now share ONE shuffle (lib/onboarding/pass.ts#displayOrder).
describe("the demo is not gameable by tapping the first tile (§18's honesty)", () => {
  it("does not put the correct answer at index 0 for every blank — driven through the REAL demo", () => {
    // Drives startDemo/stepOf, NOT displayOrder in isolation. An earlier version
    // of this test asserted the helper's permutation directly and SURVIVED a
    // mutation that reverted the demo to the engine's correct-first order —
    // because the helper was still correct, it simply was not being used.
    // Assert the OUTPUT, never the ingredient.
    const started = startDemo(C());
    if (!("state" in started)) throw new Error("demo unavailable");
    let s = started.state;
    const correctIndices: number[] = [];
    for (let guard = 0; guard < 8; guard++) {
      const step = stepOf(s, C());
      if (!step) break;
      correctIndices.push(step.item.correctIndex);
      s = applyTap(s, C(), step.item.correctIndex);
    }
    expect(correctIndices.length).toBeGreaterThan(1);
    // If EVERY blank placed the answer first, tapping tile 0 repeatedly would
    // reconstruct the ayah without reading a word, and the page would claim a
    // recall the visitor never performed.
    expect(correctIndices.every((i) => i === 0)).toBe(false);
  });

  it("is deterministic: the bank never reshuffles under the learner's finger", () => {
    // A tile moving between the decision to tap and the tap itself is a mis-tap
    // the learner reads as their OWN error.
    const a = startDemo(C());
    const b = startDemo(C());
    if (!("state" in a) || !("state" in b)) throw new Error("demo unavailable");
    const stepA = stepOf(a.state, C());
    const stepB = stepOf(b.state, C());
    expect(stepA!.item.options.map((o) => o.text)).toEqual(stepB!.item.options.map((o) => o.text));
    expect(stepA!.item.correctIndex).toBe(stepB!.item.correctIndex);
  });
});
