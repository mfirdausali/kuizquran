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
// TODO(build-plan step 20 / M6, WIREFRAME §4): the real ayah detail.
//   - The ayah itself (the `.ayah` hero from the locked CSS — the largest type
//     on the screen, always), from the corpus at runtime.
//   - Word-by-word glosses, EN at launch (v3-D15: MS is excluded from hash v1
//     and its toggle is hidden — ~11,300 glosses must be authored first).
//   - The bridge: where this ayah sits in the surah's structure.
//   - Per-ayah stats — half-life, decay since last review, time-on-task (§15)
//     — all arriving from the engine as data, in a client island.

import { notFound } from "next/navigation";
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
          {/* When the corpus lands, the text is painted into an element
              carrying dir="rtl" lang="ar" — the island, never the document. */}
          <StubNote step="step 20 (M6), WIREFRAME §4">
            The ayah text and its word-by-word glosses, loaded from the
            compiled corpus at runtime and rendered as an RTL island
            (dir=&quot;rtl&quot; lang=&quot;ar&quot;) inside this LTR page.
          </StubNote>
        </section>

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
