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
// Scoped to the two fields that need no free-typed Arabic: `gloss` (an
// English/Malay correction string) and `disable` (a boolean toggle over an
// existing word position, chosen from a dropdown built off the corpus's own
// `text_uthmani`, never typed). `distractor` needs a word-tap CorpusRef
// picker — the same reason `WorkbenchIsland`'s own spec editor leaves its
// answer picker unbuilt rather than stubbed with a free-text field — and
// `group` is deferred alongside it; both are out of scope here, named so a
// future run does not mistake the gap for an oversight.
//
// No Arabic literal anywhere in this file: `text_uthmani` fixtures below are
// synthetic placeholders ("target"/"other"), matching
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

describe("OverrideEditor — lists existing overrides for the ayah", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => resetApiFetchForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("renders zero-state honestly when nothing is recorded", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ overrides: [] })) as unknown as typeof fetch;
    render(<OverrideEditor surah={12} ayah={4} words={WORDS} />);
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

    render(<OverrideEditor surah={12} ayah={4} words={WORDS} />);
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

    render(<OverrideEditor surah={12} ayah={4} words={WORDS} />);
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
    render(<OverrideEditor surah={12} ayah={4} words={WORDS} />);
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

    render(<OverrideEditor surah={12} ayah={4} words={WORDS} />);
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

    render(<OverrideEditor surah={12} ayah={4} words={WORDS} />);
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
