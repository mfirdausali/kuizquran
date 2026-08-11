// "/progress" — RETENTION MONITORING (WIREFRAME §10).
//
// The tab's landing surface, and the honest one. §10's rule, which binds
// everything built here:
//
//   "these are the SAME NUMBERS the scheduler uses, read straight off the
//    atom's stability. Nothing is decorative. An app that shows a green
//    dashboard while its own scheduler thinks the learner is lapsing has lied
//    to them."
//
// Deliberately ABSENT, permanently: streak as the hero metric, "97% done!"
// while three ayat have lapsed, guilt copy on a missed day, leaderboards.
// `streak.ts` exists and is never the headline.
//
// A SERVER COMPONENT. Every number on the finished page is log-derived and so
// arrives through client islands (edge case #72).
//
// TODO(build-plan step 10 → M5, WIREFRAME §10 + §15):
//   - HALF-LIFE as the headline: `halfLifeDays() = stability x ln 2`.
//     "9.4 days before you'd forget half, unreviewed."
//   - Decay made visible: "72% -> 64% since Thursday" on due items.
//   - Band distribution across carry / reinforce / learn / lapsed — using the
//     locked `.bands` component, with a text label AND a number per band
//     (§15: never colour alone).
//   - Honest slippage: "3 ayat are slipping. Not a failure — this is what
//     memory does."
//   - PER-SURAH breakdown plus a COMBINED LOAD view. With N surahs there are N
//     independent decay curves competing for one budget (E-02/E-06); without
//     the combined view a learner adds a third surah and silently starves the
//     first two.

import Link from "next/link";
import { StubNote } from "@/components/shell/StubNote";

export default function ProgressPage() {
  return (
    <div className="screen">
      <div className="stack">
        <header className="page-head">
          <h1>Progress</h1>
          {/* One .voice line per screen, maximum — the locked file's §8 rule 3. */}
          <p className="voice">
            These are the same numbers the scheduler uses. Nothing here is
            decorative.
          </p>
        </header>

        <section className="card" aria-labelledby="retention-h">
          <div className="card-header">
            <h2 id="retention-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              RETENTION
            </h2>
          </div>
          <StubNote step="step 10 (M5), WIREFRAME §10">
            Half-life as the headline metric, visible decay on due items, band
            distribution, honest slippage, and the per-surah plus combined-load
            breakdown that keeps a third surah from starving the first two.
          </StubNote>
        </section>

        <section className="card" aria-labelledby="alt-h">
          <div className="card-header">
            <h2 id="alt-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
              EVERY AYAH
            </h2>
          </div>
          <p className="caption">
            The ring and the heatmap are pictures. This list is the same
            information as text — searchable, sortable, and the documented text
            alternative to the ring (§15).
          </p>
          <Link href="/progress/list" className="btn hit">
            Open the full list
          </Link>
        </section>
      </div>
    </div>
  );
}
