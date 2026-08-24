// "/surah/[surah]/[ayah]" — AYAH DETAIL (WIREFRAME §4).
//
// §4: "the bridge, restating position in the macro structure." The macro map
// appears again here in miniature, so the learner meets the structure on every
// visit rather than once in a tour (v3-D02).
//
// Both segments are awaited and validated at the boundary. A bad segment 404s;
// it never reaches the corpus loader as NaN.
//
// A SERVER COMPONENT. The Arabic on this page will arrive at RUNTIME from the
// compiled corpus — there is not, and must never be, a literal Arabic glyph in
// this file or any other. check-boundaries.mjs clause 4 enforces that, and it
// also catches the two escape hatches: a unicode escape in the Arabic range,
// and synthesising a codepoint from its numeric value.
//
// (Clause 4 does NOT strip comments before it looks, unlike clauses 3 and 5 —
// so even NAMING the codepoint-synthesis function in prose fails the build.
// That is the correct trade: this is the sacred-text guard, and a guard that
// can be talked around in a comment is one an agent will eventually talk
// around in code. Describe the hatch; never spell it.)
//
// THE RTL ISLAND RULE (WIREFRAME §15). When the ayah lands here it is painted
// inside an element carrying BOTH dir="rtl" AND lang="ar", while the document
// and all surrounding chrome stay ltr/en. Two attributes, two different jobs:
// `dir` sets the bidi paragraph level so the glyph order is right; `lang` is
// what makes a screen reader switch to an Arabic voice instead of spelling
// Arabic out in English phonemes. Mixed-direction ROWS are the classic bug —
// the number "12:4" beside an Arabic phrase must be its own ltr island, which
// is what `.ltr-island` is for.
//
// BUILD-PLAN STEP 22 landed the first two of these:
//   - THE AYAH ITSELF, from the corpus at runtime, in the `.ayah` hero (the
//     largest type on the screen, always — locked §8 rule 1).
//   - WORD-BY-WORD GLOSSES, EN at launch (v3-D15: MS is excluded from hash v1;
//     `wordGloss` falls back ms → en → the word itself, which is the chain
//     every gloss consumer must honour rather than reading `.en` directly).
//
// THE BRIDGE AND THE STATS NOW LAND HERE, and the two "STILL OPEN" notes this
// header used to carry are gone because both dependencies had already shipped:
//
//   - POSITION reuses the macro pipeline the SIBLING ROUTE already drives —
//     `macroFactsFor()` on the server, `MacroPanelIsland` on the client. The
//     one genuinely new thing is `highlight`: a COORDINATE that flags which
//     mark is current. It is NOT a filtered `nodes` array, and the distinction
//     is edge case #90 exactly — filtering the graph down to the current ayah
//     would strip every seam, and connection atoms are ~40% of a short surah's
//     memory graph. The learner is shown the whole map with one mark ringed,
//     which is what "the same macro picture at a closer zoom" has to mean.
//
//   - HOW WELL YOU HOLD IT is `AyahStatsIsland`. Log-derived, so it is a
//     CLIENT island and never this server component (edge case #72): an RSC has
//     no IndexedDB, would paint 0% and "—", and production React keeps that
//     markup after the client hydrates the truth. Every figure it prints
//     (half-life, next review, time on task) arrives from
//     `lib/progress/rows.ts` as a finished STRING — a half-life computed in
//     this JSX would be clause 5's violation and DEFECTS.md#B2's shape.
//
// `now` is captured ONCE here and handed to the island, the same arrangement
// /progress/list uses, so every figure in one render decays to the same instant.

import { notFound } from "next/navigation";
import { loadEffectiveCorpus } from "@/lib/corpus/load.ts";
import { macroFactsFor } from "@/lib/macro/facts.ts";
import { ayahWords, wordGloss } from "@engine/corpus.ts";
import { buildFace } from "@engine/faces.ts";
import { FaceText } from "@/components/quiz/FaceText";
import { MacroPanelIsland } from "@/components/macro/MacroPanelIsland";
import { AyahStatsIsland } from "@/components/progress/AyahStatsIsland";

function parseSurah(raw: string): number | null {
  if (!/^\d{1,3}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= 114 ? n : null;
}

/** Ayah numbers are 1-based and the longest surah has 286. The upper bound is
 *  a cheap sanity check only — the real bound is this surah's ayahCount, which
 *  is a CORPUS fact.
 *
 *  SO /surah/112/200 IS NOT A 404, AND THAT IS DELIBERATE (it was previously
 *  implicit, which is a different thing). 200 passes this check, `buildFace`
 *  returns null for the coordinate, and the page renders "Surah 112 has no ayah
 *  200" — a real answer that names the surah and the number the learner asked
 *  for. A notFound() here would be a worse page: it cannot say WHICH of the two
 *  segments was wrong, and the same blank 404 would cover "surah 900" (a
 *  genuinely malformed request, caught above) and "ayah 200 of a 4-ayah surah"
 *  (a plausible mistake, or a stale bookmark from before an enrolment changed).
 *
 *  The bound is not enforced HERE because enforcing it would require the corpus,
 *  and the corpus is not always available on this route — a null corpus would
 *  then 404 every ayah of a surah this build cannot serve, turning a designed
 *  "no corpus" state into a dead link. */
function parseAyah(raw: string): number | null {
  if (!/^\d{1,3}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= 286 ? n : null;
}

export default async function AyahPage({
  params,
}: {
  params: Promise<{ surah: string; ayah: string }>;
}) {
  const { surah: rawSurah, ayah: rawAyah } = await params;
  const surah = parseSurah(rawSurah);
  const ayah = parseAyah(rawAyah);
  if (surah === null || ayah === null) notFound();

  // `null` for a surah this build cannot serve — never a throw and never an
  // empty corpus (see lib/corpus/load.ts for why that distinction is the whole
  // point). A missing corpus degrades to a designed state on this one route.
  // `loadEffectiveCorpus`, not `loadCorpus`: this page prints `wordGloss(word)`
  // straight from the corpus, so a qari/admin gloss correction must reach it —
  // the SSR half of the gap v3-D96 closed for the client fetch path only.
  const effective = await loadEffectiveCorpus(surah);
  const corpus = effective?.corpus ?? null;
  const verseFace = corpus ? buildFace(corpus, { kind: "verse", ayah }) : null;
  const words = corpus ? ayahWords(corpus, ayah) : [];

  // Corpus-derived and learner-INVARIANT, so it is computed here on the server
  // and crosses into the island as a plain serialisable object. The NODES are
  // log-derived and per-learner, so the island builds them after hydration —
  // the same split the sibling route makes, for the same #72 reason.
  const facts = corpus === null ? null : macroFactsFor(corpus);
  const ayahCount = corpus?.meta.ayahCount ?? 0;

  // Read ONCE, here at the boundary, and passed down. Every figure in one
  // render then decays to the same instant; a clock read per figure would let
  // the half-life and the next-review disagree about what day it is. The engine
  // itself never calls a clock (INVARIANTS.md Absolute A).
  const now = Date.now();

  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>
            Ayah{" "}
            {/* A reference is Latin digits and a colon: an LTR island, so it
                never reorders when it sits beside Arabic. */}
            <span className="ltr-island">
              {surah}:{ayah}
            </span>
          </h1>
          <p className="caption">Where this ayah sits, and how well you hold it.</p>
        </header>

        <section className="card" aria-labelledby="ayah-h">
          <div className="card-header">
            <h2 id="ayah-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              THE AYAH
            </h2>
          </div>
          {/* The text is painted into an element carrying dir="rtl" lang="ar"
              — the island, never the document. `FaceText` is the ONE place
              that mapping happens, and the Face it paints was resolved from a
              corpus coordinate by `buildFace`, so its bytes are provably the
              compiler's. */}
          {verseFace ? (
            <FaceText face={verseFace} className="ayah" as="bdi" />
          ) : (
            <p className="stub-note">
              {corpus === null
                ? `No corpus is available for surah ${surah} in this build.`
                : `Surah ${surah} has no ayah ${ayah}.`}
            </p>
          )}
        </section>

        {words.length > 0 ? (
          <section className="card" aria-labelledby="gloss-h">
            <div className="card-header">
              <h2 id="gloss-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
                WORD BY WORD
              </h2>
            </div>
            {/* Each row is a mixed-direction line — Arabic beside a Latin
                gloss — which is edge case #80's exact shape. Both sides are
                isolated: the Arabic through FaceText's `<bdi>` + .rtl-island,
                the reference through .ltr-island. */}
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {words.map((word) => {
                const face = corpus
                  ? buildFace(corpus, { kind: "word", ayah, position: word.position })
                  : null;
                if (!face) return null;
                return (
                  <li key={word.position} className="meta-line">
                    <FaceText face={face} as="bdi" />
                    <span className="meta-line__sep">·</span>
                    {/* `wordGloss` owns the ms → en → surface fallback chain.
                        Reading `word.gloss.en` here instead would hardcode one
                        language and silently break the day MS lands. */}
                    <span>{wordGloss(word)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {/* ---- POSITION: THE BRIDGE (§4) ----------------------------------
            The island renders its own <section>/<h2> chrome, and it returns
            NULL for an ATOMIC surah (v3-D21) — so a 3-ayah surah correctly
            shows no panel here, with no skeleton flash for a panel that will
            never appear. At that size the ayah list on the surah page already
            IS the macro view.

            `highlight` is a COORDINATE. `nodes` is never narrowed to it: the
            full 2N-1 graph is built and one mark is flagged, because a filtered
            graph is a graph with no seams (#90). */}
        {facts === null ? (
          <section className="card" aria-labelledby="bridge-h">
            <div className="card-header">
              <h2 id="bridge-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
                POSITION
              </h2>
            </div>
            <p className="stub-note">
              No compiled corpus is available for surah {surah} in this build,
              so this ayah&apos;s place in the structure is not being drawn
              (DEFECTS.md#E-07).
            </p>
          </section>
        ) : (
          <MacroPanelIsland
            surah={surah}
            ayahCount={ayahCount}
            facts={facts}
            highlight={{ kind: "ayah", ayah }}
          />
        )}

        <section className="card" aria-labelledby="hold-h">
          <div className="card-header">
            <h2 id="hold-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              HOW WELL YOU HOLD IT
            </h2>
          </div>
          {corpus === null ? (
            // Never a table of fabricated zeros for a surah we hold no text
            // for. A designed state, the same one /progress/list paints.
            <p className="stub-note">
              No corpus is available for surah {surah} in this build, so there
              is nothing to measure against.
            </p>
          ) : (
            <AyahStatsIsland corpus={corpus} ayah={ayah} now={now} />
          )}
        </section>
      </div>
    </div>
  );
}
