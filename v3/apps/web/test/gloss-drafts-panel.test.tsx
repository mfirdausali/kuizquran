/**
 * @vitest-environment jsdom
 */

// `GlossDraftsPanel` — the missing UI half of `Admin\GlossDraftsController`
// (build-plan step 27, M9). See `lib/admin/glossDrafts.ts`'s own header for
// why this is buildable without content ratification: the table ships empty,
// and this panel is the scaffold a human types INTO.
//
// Mirrors `test/purge-ledger-panel.test.tsx`'s three-state discipline for the
// read half, and `test/workbench-override-editor.test.tsx`'s form-submit
// discipline for the write half.
//
// NO MALAY CONTENT ANYWHERE IN THIS FILE — every fixture and typed value below
// is a plain English placeholder, never real gloss prose.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { GlossDraftsPanel } from "@/components/admin/GlossDraftsPanel";

afterEach(cleanup);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const DRAFT_ROW = {
  id: 5,
  surah: 12,
  ayah: 3,
  position: 2,
  lang: "ms",
  text: "first draft text",
  status: "draft",
  authorKind: "human",
  authoredBy: "admin@example.com",
  reviewedBy: null,
  reviewedAt: null,
  note: null,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

const REVIEWED_ROW = { ...DRAFT_ROW, id: 6, status: "reviewed", reviewedBy: "admin@example.com" };

function emptyWorklist(surah = 12) {
  return {
    surah,
    lang: "ms",
    shipping: false,
    excludedFromHashV1: true,
    counts: { draft: 0, reviewed: 0, merged: 0, unauthored: 0 },
    drafts: [],
  };
}

describe("GlossDraftsPanel — three read states, never two", () => {
  beforeEach(() => resetApiFetchForTests());
  afterEach(() => vi.restoreAllMocks());

  it("LOADING renders no worklist at all", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<GlossDraftsPanel />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it("UNAVAILABLE names the reason and shows no fabricated rows", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    render(<GlossDraftsPanel />);
    await waitFor(() => expect(screen.getByText(/500/)).toBeTruthy());
    expect(screen.queryByText("first draft text")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("READY renders the counts and every drafted row's ayah, position, status and text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          surah: 12,
          lang: "ms",
          shipping: false,
          excludedFromHashV1: true,
          counts: { draft: 1, reviewed: 0, merged: 0, unauthored: 0 },
          drafts: [DRAFT_ROW],
        }),
      ),
    );
    render(<GlossDraftsPanel />);
    await waitFor(() => expect(screen.getByText("first draft text")).toBeTruthy());
    expect(screen.getByText(/1 draft/)).toBeTruthy();
    // `authorKind`/`authoredBy` are fetched and typed
    // (`isGlossDraftRow` requires `authorKind`) but were never rendered
    // anywhere in the table — a reviewer could not tell an AI-authored
    // draft from a human-authored one, exactly the distinction the panel's
    // own "Authored by" form field asks the admin to set on save.
    expect(screen.getByText("human · admin@example.com")).toBeTruthy();
    // `row.note` — the author's own note, captured by the panel's own
    // "Note (optional)" form field at draft time — is fetched (DRAFT_ROW's
    // `note: null` above) but was never rendered anywhere in the table,
    // only a REVIEW's own `note` inside the History column. A null note
    // falls back to the same "—" this panel already uses for a null
    // `reviewedBy`, so the row now carries exactly two dashes (reviewedBy,
    // note) rather than one.
    expect(screen.getAllByText("—")).toHaveLength(2);
    vi.unstubAllGlobals();
  });

  it("a genuinely empty worklist says so, and never fabricates a row", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(emptyWorklist())));
    render(<GlossDraftsPanel />);
    await waitFor(() => expect(screen.getByText(/no drafts yet/i)).toBeTruthy());
  });
});

describe("GlossDraftsPanel — the draft's own author is visible, not just the reviewer", () => {
  beforeEach(() => resetApiFetchForTests());
  afterEach(() => vi.restoreAllMocks());

  it("an AI-authored draft with no authoredBy renders the AI label and an em-dash, never a fabricated name", async () => {
    const aiRow = { ...DRAFT_ROW, id: 9, authorKind: "ai", authoredBy: null };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ...emptyWorklist(),
          counts: { draft: 1, reviewed: 0, merged: 0, unauthored: 0 },
          drafts: [aiRow],
        }),
      ),
    );
    render(<GlossDraftsPanel />);
    await waitFor(() => expect(screen.getByText("first draft text")).toBeTruthy());
    expect(screen.getByText("AI draft · —")).toBeTruthy();
    expect(screen.queryByText("human · admin@example.com")).toBeNull();
  });
});

describe("GlossDraftsPanel — the draft's own note is visible, not just a review's note", () => {
  beforeEach(() => resetApiFetchForTests());
  afterEach(() => vi.restoreAllMocks());

  it("renders a non-null row.note, distinct from any review-history note", async () => {
    const rowWithNote = { ...DRAFT_ROW, id: 8, note: "flag: possible false friend, double-check register" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ...emptyWorklist(),
          counts: { draft: 1, reviewed: 0, merged: 0, unauthored: 0 },
          drafts: [rowWithNote],
        }),
      ),
    );
    render(<GlossDraftsPanel />);
    await waitFor(() => expect(screen.getByText("first draft text")).toBeTruthy());
    expect(screen.getByText("flag: possible false friend, double-check register")).toBeTruthy();
  });
});

describe("GlossDraftsPanel — the review history is readable, not just current state", () => {
  beforeEach(() => resetApiFetchForTests());
  afterEach(() => vi.restoreAllMocks());

  it("renders each row's review-history note, not only the current reviewedBy", async () => {
    const rowWithHistory = {
      ...REVIEWED_ROW,
      status: "draft",
      reviewedBy: null,
      reviews: [
        {
          fromStatus: "draft",
          toStatus: "reviewed",
          textAtReview: "first draft text",
          actorKind: "human",
          actor: "reviewer@example.com",
          note: "checked against Basmeih",
          createdAt: 1_700_000_100_000,
        },
        {
          fromStatus: "reviewed",
          toStatus: "draft",
          textAtReview: "first draft text",
          actorKind: "human",
          actor: "reviewer@example.com",
          note: "wrong register — too formal",
          createdAt: 1_700_000_200_000,
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ...emptyWorklist(),
          counts: { draft: 1, reviewed: 0, merged: 0, unauthored: 0 },
          drafts: [rowWithHistory],
        }),
      ),
    );
    render(<GlossDraftsPanel />);
    await waitFor(() => expect(screen.getByText("first draft text")).toBeTruthy());
    expect(screen.getByText(/wrong register — too formal/)).toBeTruthy();
    expect(screen.getByText(/checked against Basmeih/)).toBeTruthy();
  });

  it("shows what text a review actually approved, distinct from the row's current (possibly since-edited) text", async () => {
    // GlossDraftReview's own docblock: `text_at_review` "snapshots the bytes a
    // reviewer actually approved... an approval that does not name what was
    // approved silently survives an edit that invalidated it." If the panel
    // only ever shows the row's CURRENT text, that guarantee is worthless —
    // this proves the historical approved bytes are readable even once the
    // row has since been edited away from them.
    const editedAfterReview = {
      ...DRAFT_ROW,
      id: 7,
      status: "draft",
      text: "current draft text needs recheck",
      reviewedBy: null,
      reviews: [
        {
          fromStatus: "draft",
          toStatus: "reviewed",
          textAtReview: "originally approved wording before the edit",
          actorKind: "human",
          actor: "reviewer@example.com",
          note: "checked against Basmeih",
          createdAt: 1_700_000_100_000,
        },
        {
          fromStatus: "reviewed",
          toStatus: "draft",
          textAtReview: "current draft text needs recheck",
          actorKind: "human",
          actor: null,
          note: "text edited after review — approval was for different bytes",
          createdAt: 1_700_000_200_000,
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ...emptyWorklist(),
          counts: { draft: 1, reviewed: 0, merged: 0, unauthored: 0 },
          drafts: [editedAfterReview],
        }),
      ),
    );
    render(<GlossDraftsPanel />);
    await waitFor(() => expect(screen.getByText("current draft text needs recheck")).toBeTruthy());
    expect(screen.getByText(/originally approved wording before the edit/)).toBeTruthy();
  });

  it("a row with no review history yet renders no history list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ...emptyWorklist(),
          counts: { draft: 1, reviewed: 0, merged: 0, unauthored: 0 },
          drafts: [{ ...DRAFT_ROW, reviews: [] }],
        }),
      ),
    );
    render(<GlossDraftsPanel />);
    await waitFor(() => expect(screen.getByText("first draft text")).toBeTruthy());
    expect(screen.queryByText(/checked against Basmeih/)).toBeNull();
  });
});

describe("GlossDraftsPanel — never offers the merge action", () => {
  beforeEach(() => resetApiFetchForTests());
  afterEach(() => vi.restoreAllMocks());

  it("a draft row offers only 'Mark reviewed', never a merge button", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ ...emptyWorklist(), counts: { draft: 1, reviewed: 0, merged: 0, unauthored: 0 }, drafts: [DRAFT_ROW] }),
      ),
    );
    render(<GlossDraftsPanel />);
    await waitFor(() => expect(screen.getByText("first draft text")).toBeTruthy());
    expect(screen.getByRole("button", { name: /mark reviewed/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /merge/i })).toBeNull();
  });

  it("a reviewed row offers only 'Reject to draft', never a merge button", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ...emptyWorklist(),
          counts: { draft: 0, reviewed: 1, merged: 0, unauthored: 0 },
          drafts: [REVIEWED_ROW],
        }),
      ),
    );
    render(<GlossDraftsPanel />);
    await waitFor(() => expect(screen.getByText("first draft text")).toBeTruthy());
    expect(screen.getByRole("button", { name: /reject to draft/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /merge/i })).toBeNull();
  });
});

describe("GlossDraftsPanel — the write half: draft, review, reject", () => {
  beforeEach(() => resetApiFetchForTests());
  afterEach(() => vi.restoreAllMocks());

  it("submitting the draft form posts the coordinate + text and refreshes the worklist", async () => {
    let call = 0;
    const seen: Array<{ url: string; method: string; body: unknown }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        call++;
        const url = String(input);
        seen.push({ url, method: init?.method ?? "GET", body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
        if (call === 1) return jsonResponse(emptyWorklist());
        if (init?.method === "POST") return jsonResponse({ draft: DRAFT_ROW }, 201);
        return jsonResponse({ ...emptyWorklist(), counts: { draft: 1, reviewed: 0, merged: 0, unauthored: 0 }, drafts: [DRAFT_ROW] });
      }),
    );

    render(<GlossDraftsPanel />);
    await waitFor(() => expect(screen.getByText(/no drafts yet/i)).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/^ayah$/i), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText(/word position/i), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/^text$/i), { target: { value: "first draft text" } });
    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => expect(screen.getByText("first draft text")).toBeTruthy());

    const post = seen.find((s) => s.method === "POST" && s.url.includes("/api/admin/gloss-drafts") && !s.url.includes("/review"));
    expect(post).toBeTruthy();
    expect(post!.body).toMatchObject({ surah: 12, ayah: 3, position: 2, lang: "ms", text: "first draft text" });
  });

  it("clicking 'Mark reviewed' posts toStatus:reviewed to the id-scoped review route and refreshes", async () => {
    let call = 0;
    const seen: Array<{ url: string; body: unknown }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        call++;
        const url = String(input);
        seen.push({ url, body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
        if (call === 1) return jsonResponse({ ...emptyWorklist(), counts: { draft: 1, reviewed: 0, merged: 0, unauthored: 0 }, drafts: [DRAFT_ROW] });
        if (url.includes("/review")) return jsonResponse({ draft: { ...DRAFT_ROW, status: "reviewed" } });
        return jsonResponse({ ...emptyWorklist(), counts: { draft: 0, reviewed: 1, merged: 0, unauthored: 0 }, drafts: [{ ...DRAFT_ROW, status: "reviewed" }] });
      }),
    );

    render(<GlossDraftsPanel />);
    await waitFor(() => expect(screen.getByText("first draft text")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /mark reviewed/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /reject to draft/i })).toBeTruthy());
    const reviewCall = seen.find((s) => s.url.includes("/api/admin/gloss-drafts/5/review"));
    expect(reviewCall!.body).toMatchObject({ toStatus: "reviewed", actorKind: "human" });
  });
});
