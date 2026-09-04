// THE OVERRIDE WRITE PATH — RED before green (NIGHTLY.md's working method).
//
// `OverridesController::store` (`POST /api/overrides`) has been built and
// tested on the Laravel side since build-plan step 15 (`OverridesTest.php`),
// but nothing under `apps/web` has ever called it — DECISIONS.md v3-D125
// names this exact gap: "there is still no UI anywhere for an admin/qari to
// actually correct a gloss or distractor... workbench signs verifications
// only, never writes an override." This module is that missing write half,
// mirroring `lib/workbench/sign.ts`'s never-throws discipline and
// `lib/admin/flags.ts`'s outcome-object shape.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetApiFetchForTests } from "@/lib/sync/apiFetch";
import { disableOverride, distractorOverride, glossOverride, groupOverride, submitOverride } from "./write.ts";

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

const OVERRIDE_ROW = {
  id: 9,
  surah: 12,
  ayah: 4,
  position: 1,
  questionType: "s1",
  field: "gloss",
  payload: { lang: "en", text: "when" },
  editorId: 3,
  note: null,
  createdAt: 1_700_000_000_000,
};

describe("submitOverride — posts to /api/overrides and never throws", () => {
  it("posts the exact wire shape the real controller validates", async () => {
    queue.push({ status: 201, body: { override: OVERRIDE_ROW, hashRecompute: { ok: true, rows: 3 } } });

    const result = await submitOverride({
      surah: 12,
      ayah: 4,
      position: 1,
      questionType: "s1",
      field: "gloss",
      payload: { lang: "en", text: "when" },
      note: "clarify archaic English",
    });

    expect(result.state).toBe("created");
    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.method).toBe("POST");
    expect(recorded[0]!.url).toContain("/api/overrides");
    expect(recorded[0]!.body).toEqual({
      surah: 12,
      ayah: 4,
      position: 1,
      questionType: "s1",
      field: "gloss",
      payload: { lang: "en", text: "when" },
      note: "clarify archaic English",
    });
  });

  // `CorpusHashRecomputer::recompute()` (v3-D81, DEFECTS.md#B3's live-wiring
  // closure) runs synchronously inside `OverridesController::store()` and
  // reports its own verdict back on every 201 — `{ok:bool, rows?:int,
  // error?:string}`, pinned server-side by
  // `OverrideHashRecomputeTest::test_the_override_write_itself_still_succeeds_even_if_the_surah_was_never_compiled`.
  // `submitOverride` discarded this field entirely: the caller had no way to
  // learn a recompute failed, so a stale-but-actually-correct verified
  // frontier could go undetected. This module is the sole egress
  // (`OverrideEditor.tsx` never talks to `fetch` directly), so the field
  // must survive here for anything downstream to see it.
  it("carries the server's own hashRecompute verdict through on success", async () => {
    queue.push({ status: 201, body: { override: OVERRIDE_ROW, hashRecompute: { ok: true, rows: 5 } } });
    const result = await submitOverride({
      surah: 12,
      ayah: 4,
      position: 1,
      questionType: "s1",
      field: "gloss",
      payload: { lang: "en", text: "when" },
    });
    expect(result.state).toBe("created");
    if (result.state === "created") {
      expect(result.hashRecompute).toEqual({ ok: true, rows: 5 });
    }
  });

  it("carries a FAILED hashRecompute verdict through too — the write still succeeded, the recompute did not", async () => {
    queue.push({
      status: 201,
      body: {
        override: OVERRIDE_ROW,
        hashRecompute: { ok: false, error: "surah 999 has never been compiled (no .../999/corpus.json)" },
      },
    });
    const result = await submitOverride({
      surah: 999,
      ayah: 1,
      position: 1,
      questionType: "s1",
      field: "gloss",
      payload: { lang: "en", text: "when" },
    });
    expect(result.state).toBe("created");
    if (result.state === "created") {
      expect(result.hashRecompute.ok).toBe(false);
      expect(result.hashRecompute.error).toMatch(/never been compiled/);
    }
  });

  // The real controller ALWAYS includes `hashRecompute` (it is unconditional
  // in `OverridesController::store()`). A response that omits or malforms it
  // is an anomaly this module must never read as a silent "ok" — the whole
  // point of surfacing this field is to stop a recompute failure from
  // passing as success.
  it("a missing/malformed hashRecompute degrades to a reported failure, never a silent ok", async () => {
    queue.push({ status: 201, body: { override: OVERRIDE_ROW } });
    const result = await submitOverride({
      surah: 12,
      ayah: 4,
      position: 1,
      questionType: "s1",
      field: "gloss",
      payload: { lang: "en", text: "when" },
    });
    expect(result.state).toBe("created");
    if (result.state === "created") {
      expect(result.hashRecompute.ok).toBe(false);
    }
  });

  it("a 401/403 reports the admin-gate reason, never a stack trace", async () => {
    queue.push({ status: 403, body: { error: "forbidden" } });
    const result = await submitOverride({
      surah: 12,
      ayah: 4,
      position: 1,
      questionType: "s1",
      field: "gloss",
      payload: { lang: "en", text: "when" },
    });
    expect(result.state).toBe("failed");
    if (result.state === "failed") {
      expect(result.reason).toMatch(/admin/i);
    }
  });

  it("a 422 surfaces the server's own validation message", async () => {
    queue.push({
      status: 422,
      body: { message: "The field must be one of...", errors: { field: ["The field must be one of..."] } },
    });
    const result = await submitOverride({
      surah: 12,
      ayah: 4,
      position: null,
      questionType: "s1",
      field: "gloss",
      payload: {},
    });
    expect(result.state).toBe("failed");
    if (result.state === "failed") {
      expect(result.reason).toMatch(/must be one of/);
    }
  });

  it("a network failure degrades to a failed outcome, never a throw", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const result = await submitOverride({
      surah: 12,
      ayah: 4,
      position: 1,
      questionType: "s1",
      field: "gloss",
      payload: { lang: "en", text: "when" },
    });
    expect(result.state).toBe("failed");
  });
});

describe("glossOverride — builds a gloss correction's wire shape", () => {
  it("carries the word position, language and corrected text", () => {
    const input = glossOverride(12, 4, 1, "en", "when", "clarify archaic English");
    expect(input).toEqual({
      surah: 12,
      ayah: 4,
      position: 1,
      questionType: "s1",
      field: "gloss",
      payload: { lang: "en", text: "when" },
      note: "clarify archaic English",
    });
  });
});

describe("disableOverride — builds a disable/re-enable wire shape", () => {
  it("disabled:true for a single word position", () => {
    const input = disableOverride(12, 87, 3, "vocab", true, "duplicate surface confuses grading");
    expect(input).toEqual({
      surah: 12,
      ayah: 87,
      position: 3,
      questionType: "vocab",
      field: "disable",
      payload: { disabled: true },
      note: "duplicate surface confuses grading",
    });
  });

  it("position:null covers the whole ayah, matching isQuestionDisabled's own rule", () => {
    const input = disableOverride(12, 87, null, "cloze", true);
    expect(input.position).toBeNull();
  });

  it("re-enabling posts disabled:false, an append-only correction — never an edit in place", () => {
    const input = disableOverride(12, 87, 3, "vocab", false);
    expect((input.payload as { disabled: boolean }).disabled).toBe(false);
  });
});

describe("distractorOverride — builds a full-replacement distractor set's wire shape", () => {
  it("carries the target position and the ranked replacement set", () => {
    const input = distractorOverride(
      12,
      4,
      1,
      [
        { rank: 1, text: "other", prd_rank: "override", src_type: "admin", why: "admin-selected replacement" },
        { rank: 2, text: "third", prd_rank: "override", src_type: "admin", why: "admin-selected replacement" },
      ],
      "visually similar surface",
    );
    expect(input).toEqual({
      surah: 12,
      ayah: 4,
      position: 1,
      questionType: "vocab",
      field: "distractor",
      payload: {
        distractors: [
          { rank: 1, text: "other", prd_rank: "override", src_type: "admin", why: "admin-selected replacement" },
          { rank: 2, text: "third", prd_rank: "override", src_type: "admin", why: "admin-selected replacement" },
        ],
      },
      note: "visually similar surface",
    });
  });

  it("carries no note when omitted, matching gloss/disableOverride's own optionality", () => {
    const input = distractorOverride(12, 4, 1, [
      { rank: 1, text: "other", prd_rank: "override", src_type: "admin", why: "admin-selected replacement" },
    ]);
    expect(input.note).toBeUndefined();
  });
});

describe("groupOverride — builds a multi-word idiom grouping's wire shape", () => {
  it("carries the anchor position and the other member positions, same ayah only", () => {
    const input = groupOverride(12, 4, 8, [9, 10], "eleven-word idiom");
    expect(input).toEqual({
      surah: 12,
      ayah: 4,
      position: 8,
      questionType: "s1",
      field: "group",
      payload: { groupWith: [9, 10] },
      note: "eleven-word idiom",
    });
  });

  it("carries no note when omitted, matching gloss/disableOverride's own optionality", () => {
    const input = groupOverride(12, 4, 8, [9]);
    expect(input.note).toBeUndefined();
  });
});
