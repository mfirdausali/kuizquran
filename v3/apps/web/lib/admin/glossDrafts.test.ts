// `lib/admin/glossDrafts.ts` — the missing frontend half of
// `Admin\GlossDraftsController`. RED before green (NIGHTLY.md's working
// method): this file is written and run against the tree BEFORE the
// implementation exists, then again after, per this module's own header.
//
// Mirrors `lib/admin/purgeLedger.test.ts`'s three-state read discipline and
// `lib/overrides/write.test.ts`'s never-throws write discipline — this
// surface has both halves (a worklist read, plus two writes: draft and
// review).
//
// NO MALAY CONTENT ANYWHERE IN THIS FILE. Every drafted `text` fixture below
// is a plain English placeholder describing what it stands for ("first draft
// text"), the same convention the backend's own `GlossDraftsTest.php` already
// established — never real Malay gloss prose.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { loadGlossDrafts, reviewGlossDraft, saveGlossDraft } from "./glossDrafts";

interface Recorded {
  url: string;
  method: string;
  body: unknown;
}

let recorded: Recorded[] = [];
let queue: Array<{ status: number; body: unknown }> = [];

beforeEach(() => {
  recorded = [];
  queue = [];
  resetApiFetchForTests();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);
      recorded.push({
        url,
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      });
      const next = queue.shift() ?? { status: 500, body: {} };
      return new Response(JSON.stringify(next.body), {
        status: next.status,
        headers: { "content-type": "application/json" },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

describe("loadGlossDrafts — failure is a STATE, never an exception", () => {
  it("requests the controller's real endpoint with surah + lang, through the single egress", async () => {
    queue.push({
      status: 200,
      body: { surah: 12, lang: "ms", shipping: false, excludedFromHashV1: true, counts: { draft: 0, reviewed: 0, merged: 0, unauthored: 0 }, drafts: [] },
    });

    await loadGlossDrafts(12, "ms");
    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.url).toContain("/api/admin/gloss-drafts");
    expect(recorded[0]!.url).toContain("surah=12");
    expect(recorded[0]!.url).toContain("lang=ms");
  });

  it("returns `ready` with the controller's real response shape, including the non-shipping flags", async () => {
    queue.push({
      status: 200,
      body: {
        surah: 12,
        lang: "ms",
        shipping: false,
        excludedFromHashV1: true,
        counts: { draft: 1, reviewed: 0, merged: 0, unauthored: 0 },
        drafts: [DRAFT_ROW],
      },
    });

    const load = await loadGlossDrafts(12, "ms");
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.shipping).toBe(false);
      expect(load.excludedFromHashV1).toBe(true);
      expect(load.counts.draft).toBe(1);
      expect(load.drafts).toHaveLength(1);
      expect(load.drafts[0]!.text).toBe("first draft text");
    }
  });

  it("carries a row's review history through verbatim — the append-only audit trail, not just current state", async () => {
    const row = {
      ...DRAFT_ROW,
      status: "draft",
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
    queue.push({
      status: 200,
      body: {
        surah: 12,
        lang: "ms",
        shipping: false,
        excludedFromHashV1: true,
        counts: { draft: 1, reviewed: 0, merged: 0, unauthored: 0 },
        drafts: [row],
      },
    });

    const load = await loadGlossDrafts(12, "ms");
    expect(load.state).toBe("ready");
    if (load.state === "ready") {
      expect(load.drafts[0]!.reviews).toHaveLength(2);
      expect(load.drafts[0]!.reviews?.[1]?.note).toBe("wrong register — too formal");
    }
  });

  it("a network throw becomes `unavailable`, not a rejected promise", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const load = await loadGlossDrafts(12, "ms");
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("Failed to fetch");
  });

  it("a 403 names the reason as an admin-account requirement", async () => {
    queue.push({ status: 403, body: {} });
    const load = await loadGlossDrafts(12, "ms");
    expect(load.state).toBe("unavailable");
    if (load.state === "unavailable") expect(load.reason).toContain("admin account");
  });

  it("a 200 whose JSON has no `drafts` becomes `unavailable`, never a fabricated worklist", async () => {
    queue.push({ status: 200, body: { counts: {} } });
    const load = await loadGlossDrafts(12, "ms");
    expect(load.state).toBe("unavailable");
  });
});

describe("saveGlossDraft — posts to the controller's store endpoint and never throws", () => {
  it("posts the exact wire shape the real controller validates", async () => {
    queue.push({ status: 201, body: { draft: DRAFT_ROW } });

    const result = await saveGlossDraft({
      surah: 12,
      ayah: 3,
      position: 2,
      lang: "ms",
      text: "first draft text",
      authorKind: "human",
      note: "checked against Basmeih",
    });

    expect(result.state).toBe("saved");
    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.method).toBe("POST");
    expect(recorded[0]!.url).toContain("/api/admin/gloss-drafts");
    expect(recorded[0]!.body).toEqual({
      surah: 12,
      ayah: 3,
      position: 2,
      lang: "ms",
      text: "first draft text",
      authorKind: "human",
      note: "checked against Basmeih",
    });
  });

  it("surfaces the server's own refusal reason verbatim on a 422 (e.g. the hash-language guard)", async () => {
    queue.push({ status: 422, body: { error: "this language is an input to the qari-tier hash" } });

    const result = await saveGlossDraft({
      surah: 12,
      ayah: 1,
      position: 1,
      lang: "en",
      text: "placeholder",
      authorKind: "human",
    });

    expect(result.state).toBe("failed");
    if (result.state === "failed") expect(result.reason).toContain("qari-tier hash");
  });

  it("a network throw becomes a `failed` outcome, not a rejected promise", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const result = await saveGlossDraft({ surah: 12, ayah: 1, position: 1, lang: "ms", text: "x", authorKind: "human" });
    expect(result.state).toBe("failed");
  });
});

describe("reviewGlossDraft — posts to the controller's review endpoint and never throws", () => {
  it("posts toStatus/actorKind/note to the id-scoped review route", async () => {
    queue.push({ status: 200, body: { draft: { ...DRAFT_ROW, status: "reviewed", reviewedBy: "admin@example.com" } } });

    const result = await reviewGlossDraft(5, { toStatus: "reviewed", actorKind: "human", note: "checked" });

    expect(result.state).toBe("updated");
    expect(recorded[0]!.url).toContain("/api/admin/gloss-drafts/5/review");
    expect(recorded[0]!.body).toEqual({ toStatus: "reviewed", actorKind: "human", note: "checked" });
    if (result.state === "updated") expect(result.draft.status).toBe("reviewed");
  });

  it("surfaces the server's own refusal reason verbatim when merging is refused at hash v1", async () => {
    queue.push({ status: 422, body: { error: "merging is closed at hash v1" } });

    const result = await reviewGlossDraft(5, { toStatus: "merged", actorKind: "human" });

    expect(result.state).toBe("failed");
    if (result.state === "failed") expect(result.reason).toContain("closed at hash v1");
  });
});
