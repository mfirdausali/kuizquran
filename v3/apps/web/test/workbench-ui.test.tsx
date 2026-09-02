/**
 * @vitest-environment jsdom
 */

// THE WORKBENCH PANES + THE FRONTIER CLIENT (build-plan step 25, WIREFRAME §22b).
//
// ---------------------------------------------------------------------------
// WHAT THESE TESTS ARE FOR
// ---------------------------------------------------------------------------
// Two things a pure-function test cannot reach:
//
//   1. THE THREE-STATE RULE. Loading / ready / unavailable must be three
//      distinguishable renders. A frontier that cannot be read must NOT paint
//      an empty list, because an empty list on this screen reads as "nothing
//      left to verify" — and this screen is the GATE-A metric that blocks
//      public launch. This is BUILD-PLAN's own #167 ("a failed probe renders
//      `unknown`, never 0 — the console must distinguish healthy from blind").
//
//   2. THE PREVIEW USES THE LEARNER'S OWN COMPONENTS. §22b's requirement is
//      "the SAME React components the learner sees". A test asserting only
//      "something rendered" would stay green after someone wrote a bespoke
//      admin card — the exact drift the requirement exists to prevent. So the
//      assertions look for the LOCKED classes and ARIA roles the learner's
//      `ChoiceCard` emits (`.option`, `role="radiogroup"`, `role="radio"`).
//
// Not one Arabic byte is typed here. Where a test needs the prompt's bytes it
// compares against `resolveRef(corpus, face.from)` — the corpus resolving its
// own coordinate at runtime.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Corpus } from "@engine/types.ts";
import { resolveRef } from "@engine/corpusRef.ts";
import { explain } from "@/lib/workbench/explain";
import { buildWorklist } from "@/lib/workbench/frontier";
import { FrontierNavigator } from "@/components/workbench/FrontierNavigator";
import { ExplainTrace } from "@/components/workbench/ExplainTrace";
import { WorkbenchIsland } from "@/components/workbench/WorkbenchIsland";
import { loadFrontier } from "@/lib/workbench/verifications";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { describeCertification } from "@/lib/workbench/sign";

const HERE = dirname(fileURLToPath(import.meta.url));

// v3-D22's claim rule, reused across the chip-only tests below that don't
// care about certification themselves — they just need a valid claim to
// satisfy the (required, no-default) `certification` field on a ready load.
const NO_HUMAN_CLAIM = describeCertification([], false);
const corpus = JSON.parse(
  readFileSync(resolve(HERE, "../../../packages/engine/test/fixtures/12.json"), "utf8"),
) as Corpus;

afterEach(cleanup);

describe("FrontierNavigator — three states, never two", () => {
  const noop = () => {};

  it("LOADING renders a busy skeleton and NO counts", () => {
    render(<FrontierNavigator load={{ state: "loading" }} selectedAyah={null} onSelect={noop} />);
    const section = screen.getByRole("region", { name: /verification frontier/i });
    expect(section.getAttribute("aria-busy")).toBe("true");
    // Skeletons are never zeros: a "0 verified" during load is a lie about
    // the launch gate.
    expect(section.textContent).not.toMatch(/\b0 verified\b/);
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("UNAVAILABLE renders `unknown` with the reason — NOT an empty list", () => {
    render(
      <FrontierNavigator
        load={{ state: "unavailable", reason: "the API answered 500" }}
        selectedAyah={null}
        onSelect={noop}
      />,
    );
    const section = screen.getByRole("region", { name: /verification frontier/i });
    expect(section.textContent).toContain("unknown");
    expect(section.textContent).toContain("the API answered 500");
    // THE ASSERTION THAT MATTERS: no list at all, and no count that could be
    // read as "nothing outstanding".
    expect(screen.queryByRole("list")).toBeNull();
    expect(section.textContent).not.toMatch(/\ball green\b/);
    // Announced, so it is not a silent blank pane.
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("a TRUE empty says the API returned nothing — a different sentence from unavailable", () => {
    render(
      <FrontierNavigator
        load={{
          state: "ready",
          worklist: buildWorklist({ frontier: {} }),
          certification: NO_HUMAN_CLAIM,
          verifications: [],
        }}
        selectedAyah={null}
        onSelect={noop}
      />,
    );
    const section = screen.getByRole("region", { name: /verification frontier/i });
    expect(section.textContent).toContain("no ayat");
    // Empty is not green.
    expect(section.textContent).toContain("work outstanding");
  });
});

describe("FrontierNavigator — chips are never colour alone (§15)", () => {
  const worklist = buildWorklist({
    frontier: {
      "1": { qari: "verified", admin: "verified" },
      "2": { qari: "stale", admin: "verified" },
      "3": { qari: "unverified", admin: "unverified" },
    },
  });

  it("every row carries the status as a WORD, not only a coloured dot", () => {
    render(
      <FrontierNavigator
        load={{ state: "ready", worklist, certification: NO_HUMAN_CLAIM, verifications: [] }}
        selectedAyah={null}
        onSelect={() => {}}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    // Worklist order: stale (2), unverified (3), verified (1).
    expect(items.map((li) => within(li).getByRole("button").textContent)).toEqual([
      expect.stringContaining("Stale"),
      expect.stringContaining("Unverified"),
      expect.stringContaining("Verified"),
    ]);
  });

  it("the coloured dot is aria-hidden — a screen reader is not told about a colour", () => {
    const { container } = render(
      <FrontierNavigator
        load={{ state: "ready", worklist, certification: NO_HUMAN_CLAIM, verifications: [] }}
        selectedAyah={null}
        onSelect={() => {}}
      />,
    );
    const chips = container.querySelectorAll(".wb-chip");
    expect(chips.length).toBe(3);
    for (const chip of chips) expect(chip.getAttribute("aria-hidden")).toBe("true");
  });

  it("the row's accessible name carries all three facts a sighted user gets", () => {
    render(
      <FrontierNavigator
        load={{ state: "ready", worklist, certification: NO_HUMAN_CLAIM, verifications: [] }}
        selectedAyah={null}
        onSelect={() => {}}
      />,
    );
    const stale = screen.getByRole("button", { name: /^Ayah 2\./ });
    expect(stale.getAttribute("aria-label")).toContain("Stale");
    // The note is truncated visually (`.wb-row__note` clips), so the full
    // sentence MUST survive in the label or the clipping loses information.
    expect(stale.getAttribute("aria-label")).toContain("re-sign");
  });

  it("marks the selected row with aria-current", () => {
    render(
      <FrontierNavigator
        load={{ state: "ready", worklist, certification: NO_HUMAN_CLAIM, verifications: [] }}
        selectedAyah={2}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /^Ayah 2\./ }).getAttribute("aria-current")).toBe(
      "true",
    );
    expect(
      screen.getByRole("button", { name: /^Ayah 1\./ }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("reports the ayah number a click chose, not the row's position", () => {
    const chosen: number[] = [];
    render(
      <FrontierNavigator
        load={{ state: "ready", worklist, certification: NO_HUMAN_CLAIM, verifications: [] }}
        selectedAyah={null}
        onSelect={(a) => chosen.push(a)}
      />,
    );
    // The FIRST row is ayah 2 (stale sorts first). A component reporting an
    // index would push 0 here — which is exactly the bug worth catching, since
    // the list order is deliberately not the ayah order.
    within(screen.getAllByRole("listitem")[0]!).getByRole("button").click();
    expect(chosen).toEqual([2]);
  });
});

describe("FrontierNavigator — the scholar-certification claim is on screen (v3-D22)", () => {
  // `describeCertification` (lib/workbench/sign.ts) is unit-tested in
  // workbench-sign.test.ts. What THAT suite cannot prove is that its answer
  // ever reaches a screen — before this fix it had zero callers anywhere in
  // apps/web. These tests prove the WIRING: the navigator renders exactly
  // what the claim function decided, never a sentence it assembles itself.
  const worklist = buildWorklist({ frontier: { "1": { qari: "verified", admin: "verified" } } });

  it("renders the honest non-claim when no human qari has signed", () => {
    render(
      <FrontierNavigator
        load={{ state: "ready", worklist, certification: NO_HUMAN_CLAIM, verifications: [] }}
        selectedAyah={null}
        onSelect={() => {}}
      />,
    );
    const claim = screen.getByTestId("certification-claim");
    expect(claim.textContent).toContain("No human scholar has certified this surah");
    // The v3-D22 rule itself: this state must never license the words
    // "scholar"/"certified" as an affirmative claim.
    expect(NO_HUMAN_CLAIM.mayClaimScholarVerification).toBe(false);
  });

  it("renders the scholar claim once a human qari row exists and the frontier is green", () => {
    const humanGreen = describeCertification(
      [
        {
          id: 1,
          surah: 12,
          ayah: 1,
          tier: "qari",
          contentHash: "abc",
          hashSpecVersion: 1,
          reviewerKind: "human",
          verifiedBy: "qari@example.test",
          note: null,
          createdAt: 1000,
        },
      ],
      true,
    );
    render(
      <FrontierNavigator
        load={{ state: "ready", worklist, certification: humanGreen, verifications: [] }}
        selectedAyah={null}
        onSelect={() => {}}
      />,
    );
    const claim = screen.getByTestId("certification-claim");
    expect(claim.textContent).toContain("Reviewed by a human qari");
    expect(humanGreen.mayClaimScholarVerification).toBe(true);
  });

  it("never shows the scholar claim for an AI-only row, no matter how green the frontier is", () => {
    // The exact false-positive v3-D22 exists to prevent: an AI batch run
    // recording `reviewerKind: "ai"` must not be read as a scholar's
    // signature just because the frontier is 100% hash-current.
    const aiOnlyGreen = describeCertification(
      [
        {
          id: 2,
          surah: 12,
          ayah: 1,
          tier: "qari",
          contentHash: "abc",
          hashSpecVersion: 1,
          reviewerKind: "ai",
          verifiedBy: null,
          note: null,
          createdAt: 1000,
        },
      ],
      true,
    );
    render(
      <FrontierNavigator
        load={{ state: "ready", worklist, certification: aiOnlyGreen, verifications: [] }}
        selectedAyah={null}
        onSelect={() => {}}
      />,
    );
    const claim = screen.getByTestId("certification-claim");
    expect(claim.textContent).not.toContain("Reviewed by a human qari");
    expect(claim.textContent).toContain("AI-reviewed");
    expect(aiOnlyGreen.mayClaimScholarVerification).toBe(false);
  });
});

describe("ExplainTrace — the preview is the LEARNER'S components", () => {
  const trace = explain(corpus, { lane: "s1", site: { kind: "ayah", surah: 12, ayah: 6 } });

  it("renders three previews with the learner's ChoiceCard markup", () => {
    const { container } = render(<ExplainTrace explanation={trace} surah={12} />);
    // ChoiceCard's own structure: a radiogroup of `.option` radios. A bespoke
    // admin card would not emit these, which is the point of asserting them.
    const groups = container.querySelectorAll('[role="radiogroup"]');
    expect(groups.length).toBe(3);
    for (const g of groups) {
      expect(g.querySelectorAll('[role="radio"].option').length).toBe(4);
    }
  });

  it("paints the Arabic prompt as an RTL island resolved from the corpus", () => {
    const { container } = render(<ExplainTrace explanation={trace} surah={12} />);
    const prompt = container.querySelector(".ayah bdi, .ayah .rtl-island");
    expect(prompt).toBeTruthy();
    expect(prompt!.getAttribute("dir")).toBe("rtl");
    expect(prompt!.getAttribute("lang")).toBe("ar");
    // Sacred text: those bytes are the corpus resolving its own coordinate.
    const item = trace.previews[0]!.item!;
    if (item.shape === "choice") {
      expect(prompt!.textContent).toBe(resolveRef(corpus, item.prompt.from));
    }
  });

  it("says when a strength preview is identical, and only on the non-baseline rows", () => {
    const { container } = render(<ExplainTrace explanation={trace} surah={12} />);
    const notes = [...container.querySelectorAll(".wb-preview .caption")].filter((n) =>
      n.textContent?.includes("Identical to the Learn preview"),
    );
    // Two of three: Reinforce and Carry. The Learn row is the baseline and has
    // nothing to say about sameness.
    expect(notes).toHaveLength(2);
  });

  it("shows the fibre with admit()'s verdict, and marks drops without colouring them as errors", () => {
    const { container } = render(<ExplainTrace explanation={trace} surah={12} />);
    // 12:6 — 25 enumerated, 23 admitted, 2 dropped for the prompt collision.
    expect(container.textContent).toContain("25 enumerated");
    expect(container.textContent).toContain("23 admitted");
    expect(container.querySelectorAll(".wb-var.is-dropped").length).toBe(2);
    expect(container.textContent).toContain("two correct answers");
  });

  it("a spec that builds nothing says so instead of rendering an empty card", () => {
    const dead = explain(corpus, {
      lane: "junction",
      site: { kind: "seam", surah: 12, ayah: 111 },
    });
    render(<ExplainTrace explanation={dead} surah={12} />);
    expect(screen.getByRole("status").textContent).toContain("builds nothing");
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("names the v3-D37 lane divergence rather than hiding it", () => {
    const locate = explain(corpus, {
      lane: "locate",
      site: { kind: "ayah", surah: 12, ayah: 4 },
      pool: [2, 3, 4, 5, 6],
    });
    const { container } = render(<ExplainTrace explanation={locate} surah={12} />);
    expect(container.textContent).toContain("no single-site enumerator");
    // ...and the item still renders, via the learner's LocateChoiceCard.
    expect(container.querySelectorAll('[role="radiogroup"]').length).toBe(3);
  });
});

describe("loadFrontier — failure is a STATE, never an exception", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    resetApiFetchForTests();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("returns `ready` for the controller's real response shape", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          frontier: { "1": { qari: "verified", admin: "stale" } },
          verifications: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const load = await loadFrontier(12);
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.worklist.rows[0]!.chip).toBe("stale");
      expect(load.worklist.allGreen).toBe(false);
    }
  });

  it("computes the certification claim from the `verifications` the controller sent", async () => {
    // Before this fix, `describeCertification` had zero callers anywhere —
    // the controller's `verifications` field (present since step 15) was
    // fetched and discarded by every reader. This proves loadFrontier now
    // carries it through, not merely that the pure function works in
    // isolation (workbench-sign.test.ts already covers that).
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          frontier: { "1": { qari: "verified", admin: "verified" } },
          verifications: [
            {
              id: 5,
              surah: 12,
              ayah: 1,
              tier: "qari",
              contentHash: "abc",
              hashSpecVersion: 1,
              reviewerKind: "human",
              verifiedBy: "qari@example.test",
              note: null,
              createdAt: 1000,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const load = await loadFrontier(12);
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.certification.mayClaimScholarVerification).toBe(true);
      expect(load.certification.sentence).toContain("human qari");
    }
  });

  it("never claims scholar verification when the controller sent no `verifications` at all", async () => {
    // A response missing the field entirely (an older cache, a truncated
    // body) must degrade to the safe non-claim, never throw and never
    // silently default toward a claim.
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ frontier: { "1": { qari: "verified", admin: "verified" } } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const load = await loadFrontier(12);
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.certification.mayClaimScholarVerification).toBe(false);
      expect(load.certification.sentence).toContain("No human scholar");
    }
  });

  it("requests the surah it was asked for, through the single egress", async () => {
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ frontier: {} }), { status: 200 });
    }) as unknown as typeof fetch;

    await loadFrontier(103);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("/api/verifications?surah=103");
  });

  it("a network throw becomes `unavailable`, not a rejected promise", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const load = await loadFrontier(12);
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("Failed to fetch");
  });

  it("a 500 becomes `unavailable` naming the status", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    const load = await loadFrontier(12);
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("500");
  });

  it("a 200 carrying HTML becomes `unavailable`, never an empty worklist", async () => {
    // The realistic failure: a proxy misroute returns the SPA's index.html
    // with a 200. Parsing that as "no ayat" would paint an empty worklist,
    // which reads as "nothing to verify."
    globalThis.fetch = vi.fn(async () =>
      new Response("<!doctype html><html></html>", { status: 200 }),
    ) as unknown as typeof fetch;
    const load = await loadFrontier(12);
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("not JSON");
  });

  it("a 200 whose JSON has no `frontier` becomes `unavailable`", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ verifications: [] }), { status: 200 }),
    ) as unknown as typeof fetch;
    const load = await loadFrontier(12);
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("no frontier");
  });

  it("v3-D167: carries the raw `verifications` rows through on `ready`, not just the reduced certification", async () => {
    // Before this fix, `loadFrontier`'s `ready` state reduced `verifications`
    // down to `certification` (v3-D152) and threw the raw rows away — nothing
    // downstream could ever answer "who signed this ayah, and when."
    const rows = [
      {
        id: 5,
        surah: 12,
        ayah: 1,
        tier: "qari",
        contentHash: "abc",
        hashSpecVersion: 1,
        reviewerKind: "human",
        verifiedBy: "qari@example.test",
        note: "checked distractor 3",
        createdAt: 1000,
      },
    ];
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          frontier: { "1": { qari: "verified", admin: "verified" } },
          verifications: rows,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const load = await loadFrontier(12);
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.verifications).toEqual(rows);
    }
  });

  it("v3-D167: `verifications` defaults to an empty array when the wire omitted the field", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ frontier: { "1": { qari: "verified", admin: "verified" } } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const load = await loadFrontier(12);
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.verifications).toEqual([]);
    }
  });
});

describe("WorkbenchIsland — the signature history is ayah-scoped, wired end to end", () => {
  beforeEach(() => {
    resetApiFetchForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the open ayah's own history and hides another ayah's, and re-scopes on ayah change", async () => {
    // Before this fix, `verifications.ts` fetched and typed every row (v3-D152
    // wired the aggregate `certification` from it) but no component ever read
    // a single row — `WorkbenchIsland` had nowhere for a reviewer to see WHO
    // signed a prior verification or WHAT their note said.
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          frontier: {
            "1": { qari: "verified", admin: "verified" },
            "2": { qari: "verified", admin: "verified" },
          },
          verifications: [
            {
              id: 1,
              surah: 12,
              ayah: 1,
              tier: "qari",
              contentHash: "h1",
              hashSpecVersion: 1,
              reviewerKind: "human",
              verifiedBy: "ayah-one-reviewer@example.test",
              note: null,
              createdAt: 1000,
            },
            {
              id: 2,
              surah: 12,
              ayah: 2,
              tier: "admin",
              contentHash: "h2",
              hashSpecVersion: 1,
              reviewerKind: "ai",
              verifiedBy: "ayah-two-reviewer@example.test",
              note: null,
              createdAt: 2000,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    render(<WorkbenchIsland surah={12} corpus={corpus} />);

    // Ayah 1 is the default selection — its own reviewer appears, ayah 2's
    // does not.
    expect(await screen.findByText(/ayah-one-reviewer@example\.test/)).toBeTruthy();
    expect(screen.queryByText(/ayah-two-reviewer@example\.test/)).toBeNull();

    // Move to ayah 2 the same way a reviewer does — the SPEC pane's Ayah
    // number input (`getByLabelText` would also match the frontier row
    // buttons' own `aria-label="Ayah N..."`, so scope by role instead).
    const ayahInput = screen.getByRole("spinbutton", { name: /ayah/i }) as HTMLInputElement;
    fireEvent.change(ayahInput, { target: { value: "2" } });

    expect(await screen.findByText(/ayah-two-reviewer@example\.test/)).toBeTruthy();
    expect(screen.queryByText(/ayah-one-reviewer@example\.test/)).toBeNull();
  });
});

describe("the workbench route reads the corpus through loadEffectiveCorpus (SSR override gap)", () => {
  // WorkbenchIsland's `explain(corpus, spec)` traces a spec against whatever
  // corpus it is handed — so an admin previewing a site must see the
  // override-corrected gloss/distractor text, not the raw compiled corpus.
  // `loadCorpus` alone would let an admin sign off on, or judge, stale
  // content that a correction has already superseded.
  const pageSrc = () =>
    readFileSync(resolve(HERE, "../app/(admin)/workbench/page.tsx"), "utf8");

  it("imports and calls loadEffectiveCorpus, never the raw loadCorpus", () => {
    const src = pageSrc();
    expect(src).toMatch(/loadEffectiveCorpus/);
    expect(src).not.toMatch(/\bloadCorpus\(/);
  });
});
