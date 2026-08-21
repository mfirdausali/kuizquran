// @vitest-environment jsdom
//
// The open-practice picker's RENDER contract (FR6 Door 3). Unlike
// `drill-picker.test.tsx` this component reads no log — open practice has no
// readiness precondition — so these tests only cover the ayah/difficulty
// choice and the Start link it produces.

import { describe, expect, it, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import type { Corpus } from "@engine/types.ts";

// next/link needs a mounted App Router to render; none exists in jsdom. Stub
// it to a plain anchor so the Start LINK's href is assertable — the same
// reason `drill-picker.test.tsx` stubs it.
import { vi } from "vitest";
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));

const { PracticePicker } = await import("@/components/practice/PracticePicker");

/** A corpus carrying only what the picker reads: `meta.ayahCount`. No Arabic —
 *  the picker renders no verse text, so none is needed. */
function corpusWith(ayahCount: number): Corpus {
  return {
    meta: { surah: 112, ayahCount, wordCount: 0, generatedFrom: [] },
    verses: [],
    words: [],
    distractors: [],
    connections: [],
    lookalikes: [],
    sceneBeats: [],
  } as unknown as Corpus;
}

afterEach(cleanup);

describe("PracticePicker — the ayah + difficulty choice", () => {
  it("defaults to ayah 1 and the 'partial' difficulty", () => {
    render(<PracticePicker corpus={corpusWith(4)} />);
    const partial = screen.getByRole("radio", { name: /partial/i }) as HTMLInputElement;
    const full = screen.getByRole("radio", { name: /full/i }) as HTMLInputElement;
    expect(partial.checked).toBe(true);
    expect(full.checked).toBe(false);
    expect(screen.getByTestId("practice-start").getAttribute("href")).toBe(
      "/session?practice=1&ayah=1&drill=s2",
    );
  });

  it("states the consequence of both difficulties, not just the name", () => {
    render(<PracticePicker corpus={corpusWith(4)} />);
    expect(screen.getByText("About half the ayah is blanked.")).toBeDefined();
    expect(screen.getByText("The whole ayah is blanked.")).toBeDefined();
  });

  it("carries the chosen ayah and difficulty into the Start href", () => {
    render(<PracticePicker corpus={corpusWith(4)} />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("radio", { name: /full/i }));
    expect(screen.getByTestId("practice-start").getAttribute("href")).toBe(
      "/session?practice=1&ayah=3&drill=s3",
    );
  });

  it("clamps a chosen ayah to the corpus's own range — never a coordinate that cannot exist", () => {
    render(<PracticePicker corpus={corpusWith(4)} />);
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "999" } });
    expect(screen.getByTestId("practice-start").getAttribute("href")).toBe(
      "/session?practice=1&ayah=4&drill=s2",
    );
    fireEvent.change(input, { target: { value: "0" } });
    expect(screen.getByTestId("practice-start").getAttribute("href")).toBe(
      "/session?practice=1&ayah=1&drill=s2",
    );
  });
});
