// "/surah/[surah]" — SURAH DETAIL (WIREFRAME §3, v3-D02).
//
// v3-D02: the macro view of a surah — structure, ring composition, themes,
// motifs, vocabulary — is a PANEL PINNED TO THE TOP OF THIS PAGE. Always
// visible, NEVER a gate. Gating macro-before-micro is intuitive and punishes
// returning users; ambient repetition beats a one-time mandatory tour.
//
// `params` is a Promise in this Next major and must be awaited. The surah
// number is parsed and validated HERE, at the boundary — a route segment is
// arbitrary user input, and "/surah/abc" must 404 rather than reach the corpus
// loader with NaN.
//
// A SERVER COMPONENT. Corpus is server. The per-ayah strength dots are
// log-derived, so the AYAT list below is a client island
// (`SurahAyahListIsland`) reading the log, exactly like the macro panel's own
// node data — an RSC has no IndexedDB and would paint every row "Not
// started" (edge case #72).
//
import { notFound } from "next/navigation";
import { StubNote } from "@/components/shell/StubNote";
import { MacroPanelIsland } from "@/components/macro/MacroPanelIsland";
import { SurahAyahListIsland } from "@/components/surah/SurahAyahListIsland";
import { macroFactsFor } from "@/lib/macro/facts.ts";
import { loadCorpus } from "@/lib/corpus/load.ts";

/** The Quran has 114 surahs. A segment outside that is a 404, not a clamp:
 *  quietly serving surah 1 to someone who asked for surah 900 hides the bug. */
function parseSurah(raw: string): number | null {
  if (!/^\d{1,3}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= 114 ? n : null;
}

export default async function SurahPage({
  params,
}: {
  params: Promise<{ surah: string }>;
}) {
  const { surah: rawSurah } = await params;
  const surah = parseSurah(rawSurah);
  if (surah === null) notFound();

  // Corpus is SERVER. The classification is a build-time-derived, learner-
  // invariant fact, so it is computed here and handed down as data — the view
  // never asks "how many ayat?" and never compares one (v3/CLAUDE.md rule 4).
  const corpus = await loadCorpus(surah);
  const ayahCount = corpus?.meta.ayahCount ?? 0;
  const facts = corpus === null ? null : macroFactsFor(corpus);

  // Resolved ONCE and passed down, so every row the ayat list renders decays
  // to the same instant (the same discipline /progress/list follows).
  const now = Date.now();

  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Surah {surah}</h1>
          <p className="caption">
            Structure first, then the ayat. The map stays on screen — it is
            never a gate you pass once.
          </p>
        </header>

        {/* v3-D02: the macro panel is PINNED TO THE TOP, above the ayah list.
            ALWAYS VISIBLE, NEVER A GATE.

            `facts` is computed HERE, on the server: it is corpus-derived and
            learner-invariant, so it belongs in the RSC payload. The NODES are
            log-derived and per-learner, so the island fetches them after
            hydration — an RSC has no log and would paint 0 while the client
            hydrates the real value (edge case #72).

            An ATOMIC surah renders NOTHING here (v3-D21) — the island returns
            null. At 3-8 ayat the ayah list below already IS the macro view,
            provided it carries the seams (edge case #90). */}
        {facts === null ? (
          <StubNote step="step 19 (M5), WIREFRAME §3 + v3-D21">
            No compiled corpus is available for this surah yet, so its
            structure is not being classified. The macro panel appears once the
            corpus artifact lands (DEFECTS.md#E-07).
          </StubNote>
        ) : (
          <MacroPanelIsland surah={surah} ayahCount={ayahCount} facts={facts} />
        )}

        <section className="card" aria-labelledby="ayat-h">
          <div className="card-header">
            <h2 id="ayat-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              AYAT
            </h2>
          </div>
          {corpus === null ? (
            <p className="stub-note">
              No corpus is available for surah {surah} in this build.
            </p>
          ) : (
            <SurahAyahListIsland corpus={corpus} now={now} />
          )}
        </section>
      </div>
    </div>
  );
}
