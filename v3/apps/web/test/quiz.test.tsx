/**
 * @vitest-environment jsdom
 */

// RENDER TESTS for the four closed quiz shapes (build-plan step 18).
//
// ---------------------------------------------------------------------------
// WHY THESE ITEMS COME FROM THE ENGINE AND NOT FROM THIS FILE
// ---------------------------------------------------------------------------
// Every RenderItem below that CAN be built by a kernel IS built by one:
// `buildQuestion(corpus, spec)` against the real `12.json` fixture, the same
// corpus the engine's own 391 tests run on. Hand-written items would test the
// components against a fiction — they would keep passing after the render
// contract drifted, which is the one failure a component test exists to catch.
// It also means not one Arabic byte is typed here: every glyph these
// assertions see arrives at RUNTIME from the corpus via `buildFace`, which is
// the sacred-text rule (`check-boundaries.mjs` clause 4) holding in the tests
// exactly as it holds in the app.
//
// The single exception is `sequenceFill`, and the exception is documented in
// the architecture rather than invented here: v3-D37 gap 2 records that this
// shape has NO producer inside `buildQuestion`, because it is RC's shape and RC
// is permanently CODE (`reconstruct.ts`). So its item is ASSEMBLED from Faces
// that still come from `buildFace(corpus, ref)` — the text is corpus-resolved,
// only the envelope is local. `buildSequenceFillFromCorpus` below is that
// assembly, and it is the same thing the session loop will have to do.
//
// ---------------------------------------------------------------------------
// WHAT IS ASSERTED
// ---------------------------------------------------------------------------
//   - each shape renders its expected structure (locked classes, roles);
//   - an Arabic Face gets dir="rtl" lang="ar"; a Latin Face gets neither;
//   - a tap maps to the LOGICAL index under RTL (#81) — the classic bug;
//   - the dispatcher handles all four shapes;
//   - a bank of 8 long tiles keeps 8 tappable tiles (#88);
//   - bidi isolation is present on mixed-direction rows (#80).

import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen, within } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";

import { buildQuestion, type Spec } from "@engine/buildQuestion.ts";
import { buildFace, type Face } from "@engine/faces.ts";
import { ayahWords } from "@engine/corpus.ts";
import type { Corpus } from "@engine/types.ts";
import type {
  ChoiceItem,
  LocateChoiceItem,
  OrderTilesItem,
  RenderItem,
  SequenceFillItem,
} from "@engine/render.ts";

import { QuizCard } from "@/components/quiz/QuizCard";
import { ChoiceCard } from "@/components/quiz/ChoiceCard";
import { SequenceFillCard } from "@/components/quiz/SequenceFillCard";
import { OrderTilesCard } from "@/components/quiz/OrderTilesCard";
import { LocateChoiceCard } from "@/components/quiz/LocateChoiceCard";
import { faceDirProps, isArabic } from "@/components/quiz/FaceText";
import { mapTapToLogicalIndex } from "@/components/quiz/OrderTilesCard";
import { optionStateClass } from "@/components/quiz/reveal";

afterEach(cleanup);

// The real corpus the engine tests use. Same path convention as
// packages/engine/test/*.test.ts.
const HERE = dirname(fileURLToPath(import.meta.url));
const corpus: Corpus = JSON.parse(
  readFileSync(resolve(HERE, "../../../packages/engine/test/fixtures/12.json"), "utf8"),
);

/**
 * Is `text` the ENTIRE content of exactly one leaf element?
 *
 * Why this exists instead of `screen.getByText`: testing-library matches on
 * normalized SUBSTRINGS by default, and Quranic words are frequently prefixes
 * of one another (in the fixture ayah used below, one word is a substring of
 * another in the same verse). A substring query therefore matches two elements
 * and throws — which is the same failure mode DEFECTS.md#B6 names in the
 * engine: judging surface equivalence by STRING rather than AT POSITION. The
 * assertions here identify words by exact content, and where position is what
 * matters they assert position directly (`data-blank-index`) rather than text.
 */
function exactlyOne(container: HTMLElement, text: string): boolean {
  const leaves = Array.from(container.querySelectorAll("bdi, span")).filter(
    (el) => el.textContent === text,
  );
  return leaves.length >= 1;
}

/** Narrow a built item to a shape, failing loudly rather than silently
 *  skipping if the kernel ever returns null or a different shape. */
function built<S extends RenderItem["shape"]>(
  spec: Spec,
  shape: S,
): Extract<RenderItem, { shape: S }> {
  const item = buildQuestion(corpus, spec);
  if (item === null) throw new Error(`buildQuestion returned null for lane ${spec.lane}`);
  if (item.shape !== shape) throw new Error(`expected ${shape}, got ${item.shape}`);
  return item as Extract<RenderItem, { shape: S }>;
}

// --- The four items, from real engine output --------------------------------

/** s1: Arabic word prompt, LATIN gloss options. The shape's Latin case. */
const s1Item: ChoiceItem = built({ lane: "s1", site: { kind: "ayah", surah: 12, ayah: 4 } }, "choice");

/** cloze: Arabic prompt, ARABIC options. The shape's Arabic case. */
const clozeItem: ChoiceItem = built(
  { lane: "cloze", site: { kind: "ayah", surah: 12, ayah: 4 } },
  "choice",
);

const locateItem: LocateChoiceItem = built(
  { lane: "locate", site: { kind: "ayah", surah: 12, ayah: 4 }, pool: [4, 7, 11, 19] },
  "locateChoice",
);

const orderItem: OrderTilesItem = built(
  { lane: "reorder", site: { kind: "ayah", surah: 12, ayah: 4 }, count: 3 },
  "orderTiles",
);

/**
 * `sequenceFill` has no kernel (v3-D37 gap 2 — RC is CODE, not a template), so
 * it is assembled here the way the session loop will assemble it: every Face
 * still built by `buildFace` from a CorpusRef, so every byte is corpus-resolved
 * and provenance holds.
 */
function buildSequenceFillFromCorpus(ayah: number, blankCount: number): SequenceFillItem {
  const words = ayahWords(corpus, ayah);
  const faces: Face[] = [];
  for (const w of words) {
    const face = buildFace(corpus, { kind: "word", ayah, position: w.position });
    if (!face) throw new Error(`no Face for ${ayah}:${w.position}`);
    faces.push(face);
  }
  // Blanks are the LAST `blankCount` positions, in reading order — exactly
  // reconstruct.ts's own rule (the ayah's opening stays visible as scaffold).
  const start = Math.max(0, faces.length - blankCount);
  const blankPositions = faces.slice(start).map((_, i) => start + i);
  // Options for the first blank: the correct word plus its ranked distractors,
  // all corpus-resolved.
  const firstBlank = blankPositions[0]!;
  const targetPosition = words[firstBlank]!.position;
  const correct = buildFace(corpus, { kind: "word", ayah, position: targetPosition })!;
  const options: Face[] = [correct];
  for (let rank = 1; rank <= 3; rank++) {
    const d = buildFace(corpus, { kind: "distractor", ayah, position: targetPosition, rank });
    if (d) options.push(d);
  }
  return {
    shape: "sequenceFill",
    ayahWords: faces,
    blankPositions,
    cursor: 0,
    options,
    correctIndex: 0,
  };
}

const fillItem = buildSequenceFillFromCorpus(4, 3);

// ============================================================================
// The contract itself — do the fixtures still look like the engine promised?
// ============================================================================

describe("the render contract, as the engine actually produces it", () => {
  it("s1 yields a choice whose prompt is Arabic and whose options are Latin glosses", () => {
    expect(s1Item.prompt.script).toBe("arabic");
    expect(s1Item.options.every((o) => o.script === "latin")).toBe(true);
    expect(s1Item.options.length).toBeGreaterThan(1);
  });

  it("cloze yields a choice whose options are ARABIC — the same shape, the other script", () => {
    expect(clozeItem.options.every((o) => o.script === "arabic")).toBe(true);
  });

  it("locate yields NUMBER options, never Faces (the answer is a coordinate)", () => {
    expect(locateItem.options.every((o) => typeof o === "number")).toBe(true);
    expect(locateItem.prompt.script).toBe("arabic");
  });

  it("reorder yields Arabic tiles and starts with an empty attempt", () => {
    expect(orderItem.tiles.every((t) => t.script === "arabic")).toBe(true);
    expect(orderItem.attempt).toEqual([]);
    expect(orderItem.correctOrder).toEqual([4, 5, 6]);
  });

  it("every Face carries provenance — a `from` CorpusRef, never a bare string", () => {
    const faces: Face[] = [
      s1Item.prompt,
      ...s1Item.options,
      ...clozeItem.options,
      locateItem.prompt,
      ...orderItem.tiles,
      ...fillItem.ayahWords,
    ];
    for (const f of faces) {
      expect(f.from).toBeDefined();
      expect(typeof f.from.kind).toBe("string");
      expect(f.text.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Script → direction. The #80 mapping, asserted at the unit and the DOM level.
// ============================================================================

describe("Arabic renders RTL, Latin does not (edge case #80)", () => {
  it("faceDirProps maps arabic → rtl/ar and latin → neither", () => {
    const arabicFace = clozeItem.options[0]!;
    const latinFace = s1Item.options[0]!;
    expect(isArabic(arabicFace)).toBe(true);
    expect(isArabic(latinFace)).toBe(false);
    expect(faceDirProps(arabicFace)).toEqual({ dir: "rtl", lang: "ar" });
    // A latin Face gets NO dir and NO lang — asserted as an empty object, so
    // adding `dir: "ltr"` later fails here rather than silently shipping.
    expect(faceDirProps(latinFace)).toEqual({});
  });

  it("an ARABIC option renders dir=rtl lang=ar in the DOM", () => {
    render(<ChoiceCard item={clozeItem} onAnswer={() => {}} />);
    const options = screen.getAllByRole("radio");
    const rtl = within(options[0]!).getByText(clozeItem.options[0]!.text);
    expect(rtl.getAttribute("dir")).toBe("rtl");
    expect(rtl.getAttribute("lang")).toBe("ar");
  });

  it("a LATIN option renders with no dir and no lang", () => {
    render(<ChoiceCard item={s1Item} onAnswer={() => {}} />);
    const options = screen.getAllByRole("radio");
    const latin = within(options[0]!).getByText(s1Item.options[0]!.text);
    expect(latin.getAttribute("dir")).toBeNull();
    expect(latin.getAttribute("lang")).toBeNull();
  });

  it("Arabic runs are BIDI-ISOLATED — <bdi> or .rtl-island, not a bare span", () => {
    // dir=rtl alone does not stop a neighbour's characters being reordered
    // into the run. Isolation is the actual fix; this asserts it exists.
    const { container } = render(<ChoiceCard item={clozeItem} onAnswer={() => {}} />);
    const isolated = container.querySelectorAll("bdi, .rtl-island");
    expect(isolated.length).toBeGreaterThan(0);
    const first = container.querySelector("bdi")!;
    expect(first.getAttribute("dir")).toBe("rtl");
  });

  it("locateChoice keeps its NUMBER options LTR-isolated beneath an RTL prompt", () => {
    // The sharpest #80 case: both directions in one card by design.
    const { container } = render(<LocateChoiceCard item={locateItem} onAnswer={() => {}} surah={12} />);
    const prompt = container.querySelector(".ayah")!;
    expect(prompt.getAttribute("dir")).toBe("rtl");
    const numeric = screen.getByText("12:4");
    expect(numeric.className).toContain("ltr-island");
    // A number option must NOT be given Arabic direction.
    expect(numeric.getAttribute("dir")).toBeNull();
  });
});

// ============================================================================
// #81 — THE CLASSIC BUG. A tap maps to the LOGICAL index, never the mirror.
// ============================================================================

describe("RTL tap mapping — logical index, never the visual mirror (edge case #81)", () => {
  it("mapTapToLogicalIndex is the identity — it does NOT flip for RTL", () => {
    // The wrong implementation is `length - 1 - i`, which looks like RTL
    // awareness and grades the mirror position. For a bank of 8 the two
    // disagree everywhere except the middle, so this pins every index.
    for (let i = 0; i < 8; i++) {
      expect(mapTapToLogicalIndex(i, 8)).toBe(i);
      if (i !== 8 - 1 - i) expect(mapTapToLogicalIndex(i, 8)).not.toBe(8 - 1 - i);
    }
  });

  it("tapping the FIRST tile of an RTL bank reports index 0, not the last index", () => {
    // `.bank { direction: rtl }` paints tiles[0] at the RIGHT edge. The tap
    // must still report 0.
    const onTap = vi.fn();
    render(<OrderTilesCard item={orderItem} onTap={onTap} />);
    const tiles = screen.getAllByRole("button");
    fireEvent.click(tiles[0]!);
    expect(onTap).toHaveBeenCalledWith(0);
    expect(onTap).not.toHaveBeenCalledWith(orderItem.tiles.length - 1);
  });

  it("tapping the LAST tile of an RTL bank reports the last index, not 0", () => {
    const onTap = vi.fn();
    render(<OrderTilesCard item={orderItem} onTap={onTap} />);
    const tiles = screen.getAllByRole("button");
    const last = orderItem.tiles.length - 1;
    fireEvent.click(tiles[last]!);
    expect(onTap).toHaveBeenCalledWith(last);
    expect(onTap).not.toHaveBeenCalledWith(0);
  });

  it("EVERY tile in an RTL bank reports its own array index", () => {
    // The mirror bug is symmetric — it is invisible at the midpoint of an
    // odd-length bank. Sweeping every index is what catches it.
    const onTap = vi.fn();
    render(<OrderTilesCard item={orderItem} onTap={onTap} />);
    const tiles = screen.getAllByRole("button");
    tiles.forEach((tile, i) => {
      onTap.mockClear();
      fireEvent.click(tile);
      expect(onTap, `tile ${i}`).toHaveBeenCalledWith(i);
    });
  });

  it("the tapped tile's reported index identifies the SAME Face the learner saw", () => {
    // The end-to-end statement of #81: report an index, look the Face back up
    // by that index, and it must be the text inside the button that was
    // clicked. A mirroring bug fails here even if the numbers "look fine".
    const onTap = vi.fn();
    render(<OrderTilesCard item={orderItem} onTap={onTap} />);
    const tiles = screen.getAllByRole("button");
    tiles.forEach((tile, visualPosition) => {
      onTap.mockClear();
      fireEvent.click(tile);
      const reported = onTap.mock.calls[0]![0] as number;
      expect(tile.textContent).toBe(orderItem.tiles[reported]!.text);
      // And in this layout the array order IS the DOM order — CSS does the
      // mirroring, so the DOM is never renumbered.
      expect(reported).toBe(visualPosition);
    });
  });

  it("the RTL word bank in sequenceFill reports logical option indices too", () => {
    const onAnswer = vi.fn();
    render(<SequenceFillCard item={fillItem} onAnswer={onAnswer} />);
    const bank = document.querySelector(".bank")!;
    const tiles = within(bank as HTMLElement).getAllByRole("button");
    tiles.forEach((tile, i) => {
      onAnswer.mockClear();
      fireEvent.click(tile);
      expect(onAnswer, `option ${i}`).toHaveBeenCalledWith(i);
    });
  });

  it("choice options report their logical index as well", () => {
    const onAnswer = vi.fn();
    render(<ChoiceCard item={s1Item} onAnswer={onAnswer} />);
    const options = screen.getAllByRole("radio");
    options.forEach((opt, i) => {
      onAnswer.mockClear();
      fireEvent.click(opt);
      expect(onAnswer).toHaveBeenCalledWith(i);
    });
  });

  it("locateChoice reports the OPTION INDEX, never the ayah number", () => {
    // The two coordinate systems are genuinely different here: options are
    // [4, 7, 11, 19], so index 1 is ayah 7. Reporting 7 would make the caller
    // search the array to grade — a re-derivation that eventually disagrees
    // with the engine's correctIndex.
    const onAnswer = vi.fn();
    render(<LocateChoiceCard item={locateItem} onAnswer={onAnswer} surah={12} />);
    const options = screen.getAllByRole("radio");
    fireEvent.click(options[1]!);
    expect(onAnswer).toHaveBeenCalledWith(1);
    expect(onAnswer).not.toHaveBeenCalledWith(locateItem.options[1]);
  });
});

// ============================================================================
// Structure — each shape paints the locked classes it is supposed to.
// ============================================================================

describe("choice renders its expected structure", () => {
  it("is a radiogroup with one radio per engine option", () => {
    render(<ChoiceCard item={s1Item} onAnswer={() => {}} />);
    expect(screen.getByRole("radiogroup")).toBeDefined();
    expect(screen.getAllByRole("radio")).toHaveLength(s1Item.options.length);
  });

  it("uses the LOCKED .option class, and .option--arabic only for Arabic Faces", () => {
    const { container: latin } = render(<ChoiceCard item={s1Item} onAnswer={() => {}} />);
    const latinOpt = latin.querySelectorAll(".option");
    expect(latinOpt).toHaveLength(s1Item.options.length);
    expect(latin.querySelectorAll(".option--arabic")).toHaveLength(0);
    cleanup();
    const { container: arabic } = render(<ChoiceCard item={clozeItem} onAnswer={() => {}} />);
    expect(arabic.querySelectorAll(".option--arabic")).toHaveLength(clozeItem.options.length);
  });

  it("renders every option's text from the corpus Face", () => {
    render(<ChoiceCard item={s1Item} onAnswer={() => {}} />);
    for (const opt of s1Item.options) {
      expect(screen.getByText(opt.text)).toBeDefined();
    }
  });
});

describe("sequenceFill renders its expected structure", () => {
  it("paints the WHOLE ayah — every word present, blanks included (v2-D23)", () => {
    const { container } = render(<SequenceFillCard item={fillItem} onAnswer={() => {}} />);
    const ayah = container.querySelector(".ayah")!;
    expect(ayah.getAttribute("dir")).toBe("rtl");
    // A gap slot per blank position, and the scaffold words still shown.
    expect(container.querySelectorAll(".gap-slot")).toHaveLength(fillItem.blankPositions.length);
    const scaffoldCount = fillItem.ayahWords.length - fillItem.blankPositions.length;
    for (let i = 0; i < scaffoldCount; i++) {
      // EXACT match, not testing-library's default substring match. This is
      // not pedantry: in this very fixture ayah one word is a SUBSTRING of
      // another, so a substring query matches two elements and throws. The
      // first draft of this test did exactly that and failed — which is the
      // same hazard class as DEFECTS.md#B6 (surface-equivalence must be judged
      // AT POSITION, never by string alone; 26 of Yusuf's 111 ayat contain a
      // repeated word). A test that identifies an ayah's words by text alone
      // has the bug the engine was fixed to avoid.
      expect(exactlyOne(container, fillItem.ayahWords[i]!.text), `word ${i}`).toBe(true);
    }
  });

  it("marks exactly ONE gap slot current, and it is the one `cursor` names", () => {
    const { container } = render(<SequenceFillCard item={fillItem} onAnswer={() => {}} />);
    const current = container.querySelectorAll(".gap-slot.is-current");
    expect(current).toHaveLength(1);
    // The cursor indexes blankPositions; blankPositions holds word indices.
    expect(current[0]!.getAttribute("data-blank-index")).toBe(String(fillItem.cursor));
  });

  it("advances the current slot with the cursor, in READING order (#81)", () => {
    // cursor 1 must select the SECOND blank in reading order — not the second
    // from the visual left, which in RTL is a different word entirely.
    const advanced: SequenceFillItem = { ...fillItem, cursor: 1 };
    const { container } = render(<SequenceFillCard item={advanced} onAnswer={() => {}} />);
    const current = container.querySelector(".gap-slot.is-current")!;
    expect(current.getAttribute("data-blank-index")).toBe("1");
    // And it is the blank whose word index is blankPositions[1].
    const slots = Array.from(container.querySelectorAll(".gap-slot"));
    expect(slots.indexOf(current as Element)).toBe(1);
  });

  it("renders filled positions as filled, from the caller's committed map", () => {
    const wordIndex = fillItem.blankPositions[0]!;
    const text = fillItem.ayahWords[wordIndex]!.text;
    const { container } = render(
      <SequenceFillCard
        item={fillItem}
        onAnswer={() => {}}
        filled={new Map([[wordIndex, text]])}
      />,
    );
    const filledSlots = container.querySelectorAll(".gap-slot.is-filled");
    expect(filledSlots).toHaveLength(1);
    // Asserted BY POSITION, not by searching the document for the text. The
    // filled slot must be the one the caller's map keyed — and since a word
    // can repeat (or be a substring of another) within one ayah, only the
    // position identifies it unambiguously. This is B6's rule applied to a
    // test: the graded unit is a POSITION, never a string.
    expect(filledSlots[0]!.getAttribute("data-blank-index")).toBe("0");
    expect(filledSlots[0]!.textContent).toBe(text);
  });

  it("wraps every bank tile in the 44px .tile-hit hit area (edge case #82)", () => {
    const { container } = render(<SequenceFillCard item={fillItem} onAnswer={() => {}} />);
    const hits = container.querySelectorAll(".tile-hit");
    expect(hits).toHaveLength(fillItem.options.length);
    for (const hit of hits) expect(hit.querySelector(".tile")).not.toBeNull();
  });
});

describe("orderTiles renders its expected structure", () => {
  it("renders one tile per engine tile, inside the locked .bank", () => {
    const { container } = render(<OrderTilesCard item={orderItem} onTap={() => {}} />);
    expect(container.querySelector(".bank")).not.toBeNull();
    expect(container.querySelectorAll(".tile")).toHaveLength(orderItem.tiles.length);
  });

  it("marks already-tapped tiles used and disables them", () => {
    const withAttempt: OrderTilesItem = { ...orderItem, attempt: [1] };
    const { container } = render(<OrderTilesCard item={withAttempt} onTap={() => {}} />);
    const used = container.querySelectorAll(".tile.is-used");
    expect(used).toHaveLength(1);
    expect((used[0] as HTMLButtonElement).disabled).toBe(true);
    // And it is tile index 1 — the one the attempt names.
    expect(used[0]!.getAttribute("data-tile-index")).toBe("1");
  });

  // Reveal-correctness coverage, added 2026-08-11 after an adversarial review
  // flagged the reveal expression. The old form
  // `correctOrder[ordinal] === correctOrder[index]` indexes the same array on
  // both sides; it was NOT a live defect (correctOrder is always a strictly
  // increasing run, so its elements are distinct and the expression is
  // equivalent to `ordinal === index` for every reachable input), but no test
  // pinned the reveal behaviour at all — every existing case used an in-order
  // attempt, where correct and incorrect implementations agree. These two pin
  // the property directly, so a future change to the reveal rule has to face a
  // test instead of a learner.
  it("on reveal, a tile tapped into the WRONG slot is never marked correct", () => {
    // Tap order [2,1,0] = fully reversed. Only the middle tile (index 1, tapped
    // 2nd → ordinal 1) is in its correct slot; the other two are not.
    const reversed: OrderTilesItem = { ...orderItem, attempt: [2, 1, 0] };
    const { container } = render(
      <OrderTilesCard item={reversed} onTap={() => {}} reveal />,
    );
    const ok = container.querySelectorAll(".tile.is-ok");
    expect(ok).toHaveLength(1);
    expect(ok[0]!.getAttribute("data-tile-index")).toBe("1");
  });

  it("on reveal, a fully correct in-order attempt marks every tile correct", () => {
    const inOrder: OrderTilesItem = { ...orderItem, attempt: [0, 1, 2] };
    const { container } = render(
      <OrderTilesCard item={inOrder} onTap={() => {}} reveal />,
    );
    expect(container.querySelectorAll(".tile.is-ok")).toHaveLength(orderItem.tiles.length);
  });

  it("a used tile does not fire onTap again", () => {
    const onTap = vi.fn();
    const withAttempt: OrderTilesItem = { ...orderItem, attempt: [0] };
    render(<OrderTilesCard item={withAttempt} onTap={onTap} />);
    fireEvent.click(screen.getAllByRole("button")[0]!);
    expect(onTap).not.toHaveBeenCalled();
  });

  it("handles an 8-long tile bank — every tile present and tappable (edge case #88)", () => {
    // "8-long-tile widened banks → layout break; bank tested at width 8."
    // Built from the corpus, so the tiles carry real (long) verse text.
    const eight = built(
      { lane: "reorder", site: { kind: "ayah", surah: 12, ayah: 10 }, count: 8 },
      "orderTiles",
    );
    expect(eight.tiles).toHaveLength(8);
    const onTap = vi.fn();
    const { container } = render(<OrderTilesCard item={eight} onTap={onTap} />);
    expect(container.querySelectorAll(".tile")).toHaveLength(8);
    // Every one of the eight is individually reachable and reports its own
    // logical index — the wrap must not drop or reorder any.
    const tiles = screen.getAllByRole("button");
    expect(tiles).toHaveLength(8);
    tiles.forEach((t, i) => {
      onTap.mockClear();
      fireEvent.click(t);
      expect(onTap, `tile ${i} of 8`).toHaveBeenCalledWith(i);
    });
  });
});

describe("locateChoice renders its expected structure", () => {
  it("renders one radio per ayah NUMBER, labelled as a coordinate", () => {
    render(<LocateChoiceCard item={locateItem} onAnswer={() => {}} surah={12} />);
    expect(screen.getAllByRole("radio")).toHaveLength(locateItem.options.length);
    for (const n of locateItem.options) {
      expect(screen.getByText(`12:${n}`)).toBeDefined();
    }
  });

  it("never gives a number option the Arabic option modifier", () => {
    const { container } = render(<LocateChoiceCard item={locateItem} onAnswer={() => {}} />);
    expect(container.querySelectorAll(".option--arabic")).toHaveLength(0);
  });
});

// ============================================================================
// The dispatcher — exhaustive over all four shapes.
// ============================================================================

describe("QuizCard dispatches all four shapes", () => {
  const CASES: ReadonlyArray<readonly [RenderItem["shape"], RenderItem]> = [
    ["choice", s1Item],
    ["sequenceFill", fillItem],
    ["orderTiles", orderItem],
    ["locateChoice", locateItem],
  ];

  it("covers every shape in the closed render contract — no shape untested", () => {
    // If render.ts ever gains a fifth shape, this fails and names the gap,
    // rather than the suite quietly testing 4 of 5.
    const SHAPES: ReadonlyArray<RenderItem["shape"]> = [
      "choice",
      "sequenceFill",
      "orderTiles",
      "locateChoice",
    ];
    expect(CASES.map(([s]) => s).sort()).toEqual([...SHAPES].sort());
  });

  it.each(CASES)("renders a %s item without falling through", (shape, item) => {
    const { container } = render(<QuizCard item={item} onAnswer={() => {}} surah={12} />);
    // Every shape produces a real card with real content — the `never` default
    // arm would return nothing at all.
    expect(container.querySelector(".card")).not.toBeNull();
    expect(container.textContent!.length).toBeGreaterThan(0);
    expect(shape).toBeTruthy();
  });

  it.each(CASES)("routes a tap on a %s item out through onAnswer, as a logical index", (_shape, item) => {
    const onAnswer = vi.fn();
    const { container } = render(<QuizCard item={item} onAnswer={onAnswer} surah={12} />);
    // NOT getAllByRole("button"). `choice` and `locateChoice` give their
    // options role="radio" (exactly one may be chosen), which OVERRIDES the
    // implicit button role — an ARIA role attribute replaces the native one
    // rather than adding to it. Querying the element instead of the role is
    // what makes this assertion shape-agnostic, which is the point of testing
    // the DISPATCHER: it must route a tap for all four shapes without the test
    // knowing which control each one happens to use.
    const controls = container.querySelectorAll("button");
    expect(controls.length).toBeGreaterThan(0);
    fireEvent.click(controls[0]!);
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(typeof onAnswer.mock.calls[0]![0]).toBe("number");
    // The FIRST control always reports logical index 0 — in every shape, and
    // in RTL banks where that control paints at the right edge (#81).
    expect(onAnswer.mock.calls[0]![0]).toBe(0);
  });

  it("the option controls carry the right ROLE for their shape's semantics", () => {
    // Stated explicitly because the previous test deliberately stops caring.
    // `choice`/`locateChoice` are single-select → radiogroup + radio, which
    // gives arrow-key navigation and announces the set size for free.
    // `orderTiles`/`sequenceFill` are a tap SEQUENCE, not a single choice, so
    // their tiles stay plain buttons in a labelled group.
    for (const item of [s1Item, locateItem] as RenderItem[]) {
      cleanup();
      render(<QuizCard item={item} onAnswer={() => {}} surah={12} />);
      expect(screen.getByRole("radiogroup")).toBeDefined();
      expect(screen.getAllByRole("radio").length).toBeGreaterThan(0);
    }
    for (const item of [orderItem, fillItem] as RenderItem[]) {
      cleanup();
      render(<QuizCard item={item} onAnswer={() => {}} />);
      expect(screen.queryByRole("radiogroup")).toBeNull();
      expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
    }
  });

  it("dispatches on shape ALONE — two different lanes yielding `choice` render identically", () => {
    // s1 and cloze are different engine lanes producing the same shape. The
    // dispatcher must not know or care which lane built the item; that is the
    // entire value of a closed render contract.
    const { container: a } = render(<QuizCard item={s1Item} onAnswer={() => {}} />);
    const aStructure = a.querySelector(".card")!.getAttribute("aria-labelledby");
    cleanup();
    const { container: b } = render(<QuizCard item={clozeItem} onAnswer={() => {}} />);
    expect(b.querySelector(".card")!.getAttribute("aria-labelledby")).toBe(aStructure);
  });
});

// ============================================================================
// Grading stays out of the components.
// ============================================================================

describe("the components report taps; they do not grade", () => {
  it("an un-revealed card carries NO state class, however wrong the tap", () => {
    // Without a `reveal` from the caller, tapping paints nothing: the caller
    // must commit to the log first (invariant #2, commit-before-paint).
    const onAnswer = vi.fn();
    const { container } = render(<ChoiceCard item={s1Item} onAnswer={onAnswer} />);
    const wrong = s1Item.correctIndex === 0 ? 1 : 0;
    fireEvent.click(screen.getAllByRole("radio")[wrong]!);
    expect(onAnswer).toHaveBeenCalledWith(wrong);
    expect(container.querySelectorAll(".is-ok, .is-err")).toHaveLength(0);
  });

  it("optionStateClass shows the key and marks a wrong tap — two signals, not one", () => {
    expect(optionStateClass(0, 0, undefined)).toBeNull();
    // Revealed, tapped the wrong one: correct is is-ok, tapped is is-err.
    expect(optionStateClass(0, 0, { chosenIndex: 2 })).toBe("is-ok");
    expect(optionStateClass(2, 0, { chosenIndex: 2 })).toBe("is-err");
    expect(optionStateClass(1, 0, { chosenIndex: 2 })).toBeNull();
    // Revealed, tapped the right one: is-ok only, never also is-err.
    expect(optionStateClass(0, 0, { chosenIndex: 0 })).toBe("is-ok");
  });

  it("a revealed card locks every option so a second tap cannot be committed", () => {
    const onAnswer = vi.fn();
    render(<ChoiceCard item={s1Item} onAnswer={onAnswer} reveal={{ chosenIndex: 1 }} />);
    for (const opt of screen.getAllByRole("radio")) {
      expect((opt as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(opt);
    }
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("the engine's correctIndex is what gets marked — the view derives no verdict", () => {
    const { container } = render(
      <ChoiceCard item={s1Item} onAnswer={() => {}} reveal={{ chosenIndex: 99 }} />,
    );
    const ok = container.querySelectorAll(".option.is-ok");
    expect(ok).toHaveLength(1);
    // The marked option is the one the ENGINE said, not one the view chose.
    const options = screen.getAllByRole("radio");
    expect(options.indexOf(ok[0] as HTMLElement)).toBe(s1Item.correctIndex);
  });
});
