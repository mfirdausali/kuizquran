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
// STILL OPEN:
//   - The bridge: where this ayah sits in the surah's structure (step 7 / M5).
//   - Per-ayah stats — half-life, decay since last review, time-on-task (§15).
//     These are LOG-DERIVED and so must arrive in a client island, never from
//     this server component (edge case #72). They also must arrive as DATA from
//     the engine: a half-life computed in this JSX would be clause 5's
//     violation and DEFECTS.md#B2's shape.

import { notFound } from "next/navigation";
import { loadCorpus } from "@/lib/corpus/load.ts";
import { ayahWords, wordGloss } from "@engine/corpus.ts";
import { buildFace } from "@engine/faces.ts";
import { FaceText } from "@/components/quiz/FaceText";
import { StubNote } from "@/components/shell/StubNote";

function parseSurah(raw: string): number | null {
  if (!/^\d{1,3}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= 114 ? n : null;
}

/** Ayah numbers are 1-based and the longest surah has 286. The upper bound is
 *  a cheap sanity check only — the real bound is this surah's ayahCount, which
 *  is a CORPUS fact and is checked when the corpus loads (step 6). */
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
  const corpus = await loadCorpus(surah);
  const verseFace = corpus ? buildFace(corpus, { kind: "verse", ayah }) : null;
  const words = corpus ? ayahWords(corpus, ayah) : [];

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

        <section className="card" aria-labelledby="bridge-h">
          <div className="card-header">
            <h2 id="bridge-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              POSITION
            </h2>
          </div>
          <StubNote step="step 7 (M5), WIREFRAME §4">
            The bridge — this ayah&apos;s place in the surah&apos;s structure,
            the same macro picture at a closer zoom.
          </StubNote>
        </section>

        <section className="card" aria-labelledby="hold-h">
          <div className="card-header">
            <h2 id="hold-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              HOW WELL YOU HOLD IT
            </h2>
          </div>
          <StubNote step="step 10 (M5), WIREFRAME §10 + §15">
            Half-life, decay since your last review, and cumulative
            time-on-task. These are the same numbers the scheduler uses —
            nothing here is decorative.
          </StubNote>
        </section>
      </div>
    </div>
  );
}
