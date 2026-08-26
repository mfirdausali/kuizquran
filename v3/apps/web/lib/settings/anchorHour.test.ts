// THE ANCHOR-HOUR CLIENT (v3-D140). Mirrors lib/account/api.test.ts's
// discipline: failure is a typed state, never a thrown exception, and the
// request method/body/url are asserted exactly, not merely "it resolved".

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAnchorHour, updateAnchorHour } from "./anchorHour.ts";

interface Recorded {
  url: string;
  method: string;
  body: unknown;
}

let recorded: Recorded[] = [];
let queue: Array<{ status: number; body: unknown; throwsJson?: boolean } | "network-error"> = [];

beforeEach(() => {
  recorded = [];
  queue = [];
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
      if (next === "network-error") throw new TypeError("network down");
      if (next.throwsJson) {
        return new Response("not json", { status: next.status });
      }
      return new Response(JSON.stringify(next.body), {
        status: next.status,
        headers: { "content-type": "application/json" },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAnchorHour", () => {
  it("hits GET /api/settings and returns the anchor hour", async () => {
    queue.push({ status: 200, body: { anchorHour: 8 } });

    const result = await fetchAnchorHour();

    expect(result).toEqual({ state: "ok", anchorHour: 8 });
    expect(recorded).toEqual([{ url: "/api/settings", method: "GET", body: undefined }]);
  });

  it("a network error resolves to a failed state, never a throw", async () => {
    queue.push("network-error");

    const result = await fetchAnchorHour();

    expect(result.state).toBe("failed");
  });

  it("a non-2xx response resolves to a failed state naming the status", async () => {
    queue.push({ status: 500, body: {} });

    const result = await fetchAnchorHour();

    expect(result).toEqual({ state: "failed", reason: "the API answered 500" });
  });

  it("a malformed body (no anchorHour) resolves to a failed state, not a crash", async () => {
    queue.push({ status: 200, body: { ok: true } });

    const result = await fetchAnchorHour();

    expect(result.state).toBe("failed");
  });
});

describe("updateAnchorHour", () => {
  it("POSTs /api/settings with exactly {anchorHour} and returns the new value", async () => {
    queue.push({ status: 200, body: { ok: true, anchorHour: 22.5 } });

    const result = await updateAnchorHour(22.5);

    expect(result).toEqual({ state: "ok", anchorHour: 22.5 });
    expect(recorded).toEqual([
      { url: "/api/settings", method: "POST", body: { anchorHour: 22.5 } },
    ]);
  });

  it("a 400 surfaces the server's own error message, not a re-derived one", async () => {
    queue.push({ status: 400, body: { error: "anchorHour (number, 0-24) required" } });

    const result = await updateAnchorHour(30);

    expect(result).toEqual({ state: "failed", reason: "anchorHour (number, 0-24) required" });
  });
});
