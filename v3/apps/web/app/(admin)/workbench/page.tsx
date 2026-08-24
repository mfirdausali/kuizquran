// "/workbench" — THE ADMIN SURAH–AYAH–QUIZ WORKBENCH (WIREFRAME §22b,
// build-plan step 25 / M8).
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT IN THE (app) ROUTE GROUP
// ---------------------------------------------------------------------------
// `(app)` is the LEARNER shell: it paints the tab bar and every route under it
// is something a learner is meant to find. This is staff tooling. It gets its
// own route group so it inherits no learner chrome, appears in no tab bar, and
// cannot be reached by tapping around the product. `(admin)` contributes a
// layout and no URL segment, exactly as `(app)` does, so the path stays
// "/workbench".
//
// ---------------------------------------------------------------------------
// AUTH: WHAT PROTECTS THIS TODAY, STATED PLAINLY
// ---------------------------------------------------------------------------
// The WRITE paths are protected server-side and always have been: every
// mutating admin route in `api/routes/api.php` sits behind BOTH `auth:sanctum`
// and the `admin` env-allowlist middleware, and `POST /api/verifications` and
// `POST /api/specs` are among them. Nothing this page can do reaches a write
// without passing those two gates.
//
// What this page reads — `GET /api/verifications` — is a deliberate PUBLIC
// read, and the route says so at its own definition: "the admin console's
// not-yet-built worklist view and any future public transparency page both need
// this un-gated." So there is no data on this screen that is not already
// publicly readable, and no privileged read is being introduced here.
//
// What is NOT built: a client-side admin auth gate that keeps this ROUTE from
// rendering for a non-admin. That belongs with the console's own session
// surface (build-plan step 24's `POST /api/admin/login` + the admin token),
// and shipping half of it — a redirect with no server enforcement behind it —
// would be security theatre. It is named in the route's remaining-work list
// rather than faked.
//
// ---------------------------------------------------------------------------
// SERVER / CLIENT SPLIT
// ---------------------------------------------------------------------------
//     Corpus is server. Log is client. Skeletons are never zeros.
//
// The corpus is loaded HERE, on the server, by the one module that knows where
// a corpus comes from. The frontier is fetched in the island at mount, because
// it is mutable per-request state: a qari signs an ayah, the chip must move,
// and a server-rendered frontier would be stale from the moment it painted.
//
// ---------------------------------------------------------------------------
// WHAT IS BUILT HERE, AND WHAT REMAINS — §22b's three panes
// ---------------------------------------------------------------------------
// BUILT:
//   - Pane 1, the AYAH NAVIGATOR with verification chips (green verified /
//     amber stale / grey unverified) ordered as a WORKLIST, over the REAL
//     step-15 API.
//   - Pane 3's preview half: `explain()` — supply, the full fibre with
//     admit()'s per-clause verdict, and a live preview at three strengths
//     rendered by the LEARNER'S OWN components.
//
// REMAINING (honestly, not silently):
//   - Pane 2, the AYAH WORKBENCH: the learner's exact word-by-word rendering
//     with a per-word inspector.
//   - Pane 3's EDITOR half: authoring a spec (shape, EN/MS prompt, answer BY
//     TAPPING A WORD → a CorpusRef, foil kernels with bounded params,
//     difficulty offset), and the POST to `/api/specs`.
//   - Editing `gloss.en`/`gloss.ms`, replacing distractor sets, grouping
//     multi-word units, disabling a question type, tombstoning.
//   - QARI MODE: sign-time hash recompute against `POST /api/verifications`
//     (the server side is TOCTOU-proof already — it reads its own ingested
//     hash and ignores any client-submitted one — but the signing UI, the
//     role check and the red REJECTED state are not built).
//   - The admin auth gate on this route (see above).

import { notFound } from "next/navigation";
import { loadEffectiveCorpus, AVAILABLE_SURAHS } from "@/lib/corpus/load.ts";
import { WorkbenchIsland } from "@/components/workbench/WorkbenchIsland";

/** The surah under edit. A query parameter rather than a path segment: the
 *  workbench is one screen an admin re-points, not a set of pages. Anything
 *  outside what this build can serve 404s rather than rendering an empty
 *  workbench that looks like a surah with no content. */
function parseSurah(raw: string | undefined): number | null {
  if (raw === undefined) return AVAILABLE_SURAHS[0] ?? null;
  if (!/^\d{1,3}$/.test(raw)) return null;
  const n = Number(raw);
  return AVAILABLE_SURAHS.includes(n) ? n : null;
}

export default async function WorkbenchPage({
  searchParams,
}: {
  searchParams: Promise<{ surah?: string }>;
}) {
  const { surah: rawSurah } = await searchParams;
  const surah = parseSurah(rawSurah);
  if (surah === null) notFound();

  // `loadEffectiveCorpus`, not `loadCorpus`: `explain()` below traces the
  // spec against whatever corpus it is given, so an admin previewing a site
  // must see the CURRENT, override-corrected gloss/distractor text — the same
  // SSR override gap v3-D96 closed for the learner-facing client fetch path
  // only. Returns null rather than throwing or fabricating an empty corpus
  // (E-07's shape). A workbench with no corpus has nothing to trace, so it
  // 404s rather than painting three empty panes that read as "this surah has
  // no questions."
  const effective = await loadEffectiveCorpus(surah);
  const corpus = effective?.corpus ?? null;
  if (corpus === null) notFound();

  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>
            Workbench <span className="ltr-island">surah {surah}</span>
          </h1>
          <p className="caption">
            The verification frontier as a worklist, and what the question
            compiler actually produces at a site.
          </p>
        </header>

        <WorkbenchIsland surah={surah} corpus={corpus} />
      </div>
    </div>
  );
}
