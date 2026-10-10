// /plan MUST RENDER AT REQUEST TIME — a production-only defect (v3-D301).
//
// `app/(app)/plan/page.tsx` resolves `now = Date.now()` on the server and
// hands it to `PlanIsland`, which uses it for the calendar's dates, "due
// today", decay, and the absolute day index `setDayAway` writes. Until v3-D301
// the page touched no request-time API, so `next build` PRERENDERED it (`○
// /plan`) and `next start` served the BUILD instant to every request, cached
// for a year. `next dev` renders per request, so the defect is invisible
// there; and because this suite builds seconds before it runs, a frozen `now`
// is only seconds stale — so asserting "now is close to the wall clock" would
// pass vacuously here. What a prerender cannot fake is two requests disagreeing:
// a request-time render resolves a fresh instant per request, a prerendered
// page replays one constant.
//
// The instant is read out of the RSC payload the page actually ships (the
// `now` prop handed to `PlanIsland`), not out of visible copy, because no
// rendered sentence prints it. `request` only — no browser, no IndexedDB.

import { expect, test } from "@playwright/test";

/** The `now` prop serialized into /plan's RSC payload, as epoch ms. */
async function servedNow(request: import("@playwright/test").APIRequestContext): Promise<number> {
  const res = await request.get("/plan");
  expect(res.ok(), "/plan responds").toBe(true);
  const html = await res.text();
  const m = html.match(/now\\?"\s*:\s*(\d{13})/);
  expect(m, "/plan's payload carries the server-resolved `now` prop").not.toBeNull();
  return Number(m![1]);
}

test.describe("/plan · request-time rendering (v3-D301)", () => {
  test("two requests get two different server instants, never one frozen build instant", async ({
    request,
  }) => {
    const first = await servedNow(request);
    // Comfortably longer than any clock granularity, so a request-time render
    // cannot plausibly repeat the same millisecond.
    await new Promise((r) => setTimeout(r, 1_100));
    const second = await servedNow(request);

    expect(
      second,
      "a prerendered /plan replays the build instant to every request — " +
        "`await connection()` must precede the page's Date.now()",
    ).toBeGreaterThan(first);
  });

  test("the response is not a year-long cached prerender", async ({ request }) => {
    const res = await request.get("/plan");
    expect(res.headers()["x-nextjs-prerender"], "/plan must not be served from a prerender").toBeUndefined();
  });
});
