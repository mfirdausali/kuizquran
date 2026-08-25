/**
 * @vitest-environment jsdom
 */

// `OverrideEditor` — the missing write-side UI for `OverridesController::store`
// (build-plan step 15's admin write path). Read here means `GET /api/overrides`
// (`lib/overrides/fetch.ts`, already called by the learner corpus loader);
// write means `POST /api/overrides`, which DECISIONS.md v3-D125 names as
// having zero frontend callers anywhere — "there is still no UI anywhere for
// an admin/qari to actually correct a gloss or distractor... workbench signs
// verifications only, never writes an override." This is that missing UI.
//
// Scoped to three fields that need no free-typed Arabic: `gloss` (an
// English/Malay correction string), `disable` (a boolean toggle over an
// existing word position, chosen from a dropdown built off the corpus's own
// `text_uthmani`, never typed) and `distractor` (a full-replacement set
// built the same way — a target-word dropdown plus up to
// `DISTRACTOR_SLOTS` replacement-word dropdowns, each option's label and
// posted `text` read back out of the corpus prop, never typed). `group`
// (multi-word idiom grouping) remains deferred, real, separate future
// work — out of scope here, named so a future run does not mistake the gap
// for an oversight.
//
// No Arabic literal anywhere in this file: `text_uthmani` fixtures below are
// synthetic placeholders ("target"/"other"/"third"), matching
// `test/content-freeze-gate.test.ts`'s own convention — a real ayah's bytes
// are never typed into a test.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { OverrideEditor } from "@/components/workbench/OverrideEditor";
import type { CorpusWord } from "@engine/types.ts";

afterEach(cleanup);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const WORDS: CorpusWord[] = [
  { ayah: 4, position: 1, text_uthmani: "target", lemma: null, root: null, class: null, gloss: { en: "when", ms: null, ja: null }, act: null, sceneImage: null },
  { ayah: 4, position: 2, text_uthmani: "other", lemma: null, root: null, class: null, gloss: { en: "said", ms: null, ja: null }, act: null, sceneImage: null },
];

// The distractor picker's replacement pool spans the WHOLE surah, so this
// fixture deliberately includes a word from a DIFFERENT ayah (5) — proving
// the picker's `${ayah}:${position}` keying, not just same-ayah position
// numbers, which would pass vacuously if the two ayat happened to share
// numbering by coincidence.
const SURAH_WORDS: CorpusWord[] = [
  ...WORDS,
  { ayah: 5, position: 1, text_uthmani: "third", lemma: null, root: null, class: null, gloss: { en: "then", ms: null, ja: null }, act: null, sceneImage: null },
];

describe("OverrideEditor — lists existing overrides for the ayah", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("renders zero-state honestly when nothing is recorded", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ overrides: [] })) as unknown as typeof fetch;
    render(<OverrideEditor surah={12} ayah={4} words={WORDS} surahWords={SURAH_WORDS} />);
    await waitFor(() => expect(screen.getByText(/no overrides recorded/i)).toBeTruthy());
  });

  it("shows a recorded override, scoped to the open ayah only", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        overrides: [
          {
            id: 1, surah: 12, ayah: 4, position: 1, questionType: "s1", field: "gloss",
            payload: { lang: "en", text: "when" }, editorId: 3, note: null, createdAt: 1_700_000_000_000,
          },
          {
            id: 2, surah: 12, ayah: 9, position: 1, questionType: "s1", field: "gloss",
            payload: { lang: "en", text: "different ayah" }, editorId: 3, note: null, createdAt: 1_700_000_000_001,
          },
        ],
      }),
    ) as unknown as typeof fetch;

    render(<OverrideEditor surah={12} ayah={4} words={WORDS} surahWords={SURAH_WORDS} />);
    await waitFor(() => expect(screen.getByTestId("override-list")).toBeTruthy());
    expect(screen.getByText(/"when"/)).toBeTruthy();
    expect(screen.queryByText(/different ayah/)).toBeNull();
  });
});

describe("OverrideEditor — submitting a gloss correction", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("posts the field's exact wire shape and refreshes the list on success", async () => {
    const calls: Array<{ url: string; method: string; body: unknown }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (method === "POST") {
        return jsonResponse(
          {
            override: {
              id: 5, surah: 12, ayah: 4, position: 1, questionType: "s1", field: "gloss",
              payload: { lang: "en", text: "at the time" }, editorId: 3, note: null, createdAt: 1_700_000_000_002,
            },
          },
          201,
        );
      }
      const posted = calls.some((c) => c.method === "POST");
      return jsonResponse({
        overrides: posted
          ? [
              {
                id: 5, surah: 12, ayah: 4, position: 1, questionType: "s1", field: "gloss",
                payload: { lang: "en", text: "at the time" }, editorId: 3, note: null, createdAt: 1_700_000_000_002,
              },
            ]
          : [],
      });
    }) as unknown as typeof fetch;

    render(<OverrideEditor surah={12} ayah={4} words={WORDS} surahWords={SURAH_WORDS} />);
    await waitFor(() => expect(screen.getByText(/no overrides recorded/i)).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/^word$/i), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/corrected gloss/i), { target: { value: "at the time" } });
    fireEvent.click(screen.getByRole("button", { name: /submit gloss correction/i }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.url).toContain("/api/overrides");
    expect(post.body).toMatchObject({
      surah: 12,
      ayah: 4,
      position: 1,
      field: "gloss",
      payload: { lang: "en", text: "at the time" },
    });

    await waitFor(() => expect(screen.getByText(/"at the time"/)).toBeTruthy());
  });

  it("cannot submit without choosing a word or typing a correction", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ overrides: [] })) as unknown as typeof fetch;
    render(<OverrideEditor surah={12} ayah={4} words={WORDS} surahWords={SURAH_WORDS} />);
    await waitFor(() => expect(screen.getByText(/no overrides recorded/i)).toBeTruthy());
    const submit = screen.getByRole("button", { name: /submit gloss correction/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });
});

describe("OverrideEditor — disabling and re-enabling a question", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("a whole-ayah disable posts position:null and the chosen question type", async () => {
    const calls: Array<{ method: string; body: unknown }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ method, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (method === "POST") {
        return jsonResponse(
          {
            override: {
              id: 7, surah: 12, ayah: 4, position: null, questionType: "cloze", field: "disable",
              payload: { disabled: true }, editorId: 3, note: null, createdAt: 1_700_000_000_003,
            },
          },
          201,
        );
      }
      return jsonResponse({ overrides: [] });
    }) as unknown as typeof fetch;

    render(<OverrideEditor surah={12} ayah={4} words={WORDS} surahWords={SURAH_WORDS} />);
    await waitFor(() => expect(screen.getByText(/no overrides recorded/i)).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/question type/i), { target: { value: "cloze" } });
    fireEvent.click(screen.getByRole("button", { name: /^disable$/i }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.body).toMatchObject({
      surah: 12,
      ayah: 4,
      position: null,
      questionType: "cloze",
      field: "disable",
      payload: { disabled: true },
    });
  });

  it("a listed disable row offers Re-enable, which posts disabled:false", async () => {
    const calls: Array<{ method: string; body: unknown }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ method, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (method === "POST") {
        return jsonResponse(
          {
            override: {
              id: 8, surah: 12, ayah: 4, position: 2, questionType: "vocab", field: "disable",
              payload: { disabled: false }, editorId: 3, note: "re-enabled from workbench", createdAt: 1_700_000_000_004,
            },
          },
          201,
        );
      }
      return jsonResponse({
        overrides: [
          {
            id: 8, surah: 12, ayah: 4, position: 2, questionType: "vocab", field: "disable",
            payload: { disabled: true }, editorId: 3, note: null, createdAt: 1_700_000_000_004,
          },
        ],
      });
    }) as unknown as typeof fetch;

    render(<OverrideEditor surah={12} ayah={4} words={WORDS} surahWords={SURAH_WORDS} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /re-enable/i })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /re-enable/i }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.body).toMatchObject({
      surah: 12,
      ayah: 4,
      position: 2,
      questionType: "vocab",
      field: "disable",
      payload: { disabled: false },
    });
  });
});

describe("OverrideEditor — replacing a distractor set", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("posts a full-replacement set built from picked words, ranked in pick order, never a typed field", async () => {
    const calls: Array<{ method: string; body: unknown }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ method, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (method === "POST") {
        return jsonResponse(
          {
            override: {
              id: 11, surah: 12, ayah: 4, position: 1, questionType: "vocab", field: "distractor",
              payload: {
                distractors: [
                  { rank: 1, text: "other", prd_rank: "override", src_type: "admin", why: "admin-selected replacement" },
                  { rank: 2, text: "third", prd_rank: "override", src_type: "admin", why: "admin-selected replacement" },
                ],
              },
              editorId: 3, note: null, createdAt: 1_700_000_000_005,
            },
          },
          201,
        );
      }
      const posted = calls.some((c) => c.method === "POST");
      return jsonResponse({
        overrides: posted
          ? [
              {
                id: 11, surah: 12, ayah: 4, position: 1, questionType: "vocab", field: "distractor",
                payload: {
                  distractors: [
                    { rank: 1, text: "other", prd_rank: "override", src_type: "admin", why: "admin-selected replacement" },
                    { rank: 2, text: "third", prd_rank: "override", src_type: "admin", why: "admin-selected replacement" },
                  ],
                },
                editorId: 3, note: null, createdAt: 1_700_000_000_005,
              },
            ]
          : [],
      });
    }) as unknown as typeof fetch;

    render(<OverrideEditor surah={12} ayah={4} words={WORDS} surahWords={SURAH_WORDS} />);
    await waitFor(() => expect(screen.getByText(/no overrides recorded/i)).toBeTruthy());

    // Target word #1 ("target"); replacements picked from ACROSS the surah —
    // #2 in the same ayah and #1 of ayah 5 — proving the compound
    // `${ayah}:${position}` key resolves the cross-ayah pick correctly.
    fireEvent.change(screen.getByLabelText(/target word/i), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/replacement 1/i), { target: { value: "4:2" } });
    fireEvent.change(screen.getByLabelText(/replacement 2/i), { target: { value: "5:1" } });
    fireEvent.click(screen.getByRole("button", { name: /replace distractors/i }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.body).toMatchObject({
      surah: 12,
      ayah: 4,
      position: 1,
      field: "distractor",
      payload: {
        distractors: [
          { rank: 1, text: "other" },
          { rank: 2, text: "third" },
        ],
      },
    });

    await waitFor(() => expect(screen.getByText(/2 replacements/)).toBeTruthy());
  });

  it("the target word is never offered as its own replacement", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ overrides: [] })) as unknown as typeof fetch;
    render(<OverrideEditor surah={12} ayah={4} words={WORDS} surahWords={SURAH_WORDS} />);
    await waitFor(() => expect(screen.getByText(/no overrides recorded/i)).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/target word/i), { target: { value: "1" } });
    const replacement1 = screen.getByLabelText(/replacement 1/i) as HTMLSelectElement;
    const optionValues = Array.from(replacement1.options).map((o) => o.value);
    expect(optionValues).not.toContain("4:1");
    expect(optionValues).toContain("4:2");
    expect(optionValues).toContain("5:1");
  });

  it("cannot submit without a target word and at least one replacement pick", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ overrides: [] })) as unknown as typeof fetch;
    render(<OverrideEditor surah={12} ayah={4} words={WORDS} surahWords={SURAH_WORDS} />);
    await waitFor(() => expect(screen.getByText(/no overrides recorded/i)).toBeTruthy());

    const submit = screen.getByRole("button", { name: /replace distractors/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/target word/i), { target: { value: "1" } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/replacement 1/i), { target: { value: "4:2" } });
    expect(submit.disabled).toBe(false);
  });
});
