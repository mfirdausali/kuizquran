"use client";

// THE WORKBENCH ISLAND (§22b, build-plan step 25) — the client half.
//
//     Corpus is server. Log is client.
//
// The corpus arrives as a PROP from the server component, already loaded from
// disk by `lib/corpus/load.ts`. The frontier arrives from the API at mount,
// because it is per-request mutable state (a qari signs an ayah and the chip
// must move) and server-rendering it would paint a stale frontier that never
// updates.
//
// WHAT THIS FILE DECIDES: which ayah is open and which lane is being previewed.
// That is navigation state, not an engine decision. Every question about the
// spec itself — does it build, what did admit() drop, what does each strength
// produce — is answered by `explain()`, called here and rendered there.
//
// WHY THE SPEC EDITOR IS A LANE PICKER AND NOT A FORM. §22b's full editor lets
// an author "author a spec (shape, EN/MS prompt, answer BY TAPPING A WORD, foil
// kernels with bounded params, difficulty offset), preview, tombstone" and POST
// it to `/api/specs`. That is a substantial surface and it is NOT built here —
// see the route's own header for exactly what remains. What IS built is the
// half that had no path to existing at all: a spec is selected, `explain()`
// traces it, and the learner's own components paint it. An author can see the
// compiler's actual behaviour at a site today, which is the thing step 25 was
// blocked on.
//
// The word-tapping answer picker is deliberately absent rather than stubbed.
// §22b's structural guarantee is "cannot type Arabic into any answer field —
// no such field exists", and the way to keep that true is to ship the picker
// with its CorpusRef plumbing intact, not to ship a text input now and promise
// to replace it.

import { useEffect, useMemo, useState } from "react";
import type { Corpus } from "@engine/types.ts";
import type { Spec } from "@engine/buildQuestion.ts";
import { explain } from "@/lib/workbench/explain.ts";
import { loadFrontier, type FrontierLoad } from "@/lib/workbench/verifications.ts";
import { FrontierNavigator } from "./FrontierNavigator";
import { ExplainTrace } from "./ExplainTrace";

/** The lanes this picker can select. `rc` is absent BY DESIGN — WIREFRAME's
 *  DATA/CODE table keeps reconstruct.ts's state machine as CODE permanently,
 *  and `buildQuestion` structurally refuses it. Offering it here would be
 *  offering a spec the compiler will always decline. */
const PICKABLE_LANES = ["s1", "cloze", "junction", "locate", "reorder"] as const;
type PickableLane = (typeof PICKABLE_LANES)[number];

export interface WorkbenchIslandProps {
  surah: number;
  corpus: Corpus;
}

/** Build the Spec for a (lane, ayah) selection. `locate` and `reorder` carry
 *  data a Site cannot supply (v3-D30/v3-D36: a pool and a run length), so the
 *  workbench supplies the defaults the legacy builders use — stated here, in
 *  one place, rather than scattered as literals through the render. */
function specFor(lane: PickableLane, surah: number, ayah: number, ayahCount: number): Spec {
  switch (lane) {
    case "s1":
      return { lane: "s1", site: { kind: "ayah", surah, ayah } };
    case "cloze":
      return { lane: "cloze", site: { kind: "ayah", surah, ayah } };
    case "junction":
      // A seam binds to its FROM ayah — the seam IS the coordinate (§23).
      return { lane: "junction", site: { kind: "seam", surah, ayah } };
    case "locate": {
      // The Test's own candidate range. A short window around the ayah,
      // clamped to the surah, which is what a range drill would hand it.
      const pool: number[] = [];
      for (let a = Math.max(1, ayah - 2); a <= Math.min(ayahCount, ayah + 2); a++) {
        pool.push(a);
      }
      return { lane: "locate", site: { kind: "ayah", surah, ayah }, pool };
    }
    case "reorder":
      return { lane: "reorder", site: { kind: "ayah", surah, ayah }, count: 3 };
    default: {
      const _exhaustive: never = lane;
      return _exhaustive;
    }
  }
}

export function WorkbenchIsland({ surah, corpus }: WorkbenchIslandProps) {
  const [load, setLoad] = useState<FrontierLoad>({ state: "loading" });
  const [ayah, setAyah] = useState<number>(1);
  const [lane, setLane] = useState<PickableLane>("s1");

  useEffect(() => {
    let live = true;
    void loadFrontier(surah).then((next) => {
      // A late resolution after unmount (or after a surah change) must not
      // paint a frontier for the wrong surah.
      if (live) setLoad(next);
    });
    return () => {
      live = false;
    };
  }, [surah]);

  const ayahCount = corpus.meta.ayahCount;
  const spec = useMemo(
    () => specFor(lane, surah, ayah, ayahCount),
    [lane, surah, ayah, ayahCount],
  );
  // The tracer is pure and cheap relative to a render, but a full-fibre trace
  // walks every variant at the site — memoized so typing in the picker does
  // not re-run it per keystroke of React's own re-render churn.
  const explanation = useMemo(() => explain(corpus, spec), [corpus, spec]);

  return (
    <div className="wb-grid">
      <FrontierNavigator load={load} selectedAyah={ayah} onSelect={setAyah} />

      <section className="card" aria-labelledby="spec-h">
        <div className="card-header">
          <h2 id="spec-h" className="wb-h">
            SPEC
          </h2>
          <span className="ltr-island">
            {surah}:{ayah}
          </span>
        </div>

        <label className="wb-field">
          <span className="caption">Ayah</span>
          <input
            type="number"
            min={1}
            max={ayahCount}
            value={ayah}
            onChange={(e) => {
              const next = Number(e.target.value);
              // Clamp at the boundary rather than letting an out-of-range
              // coordinate reach a kernel: `expand` throws on one, and a
              // thrown range error inside a render is a blank screen.
              if (Number.isInteger(next) && next >= 1 && next <= ayahCount) {
                setAyah(next);
              }
            }}
          />
        </label>

        <fieldset className="wb-field">
          <legend className="caption">Lane</legend>
          <div className="stack stack--tight">
            {PICKABLE_LANES.map((l) => (
              <label key={l} className="wb-lane-opt">
                <input
                  type="radio"
                  name="wb-lane"
                  value={l}
                  checked={lane === l}
                  onChange={() => setLane(l)}
                />
                <span>{l}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <p className="caption">
          {/* The honest scope line, on the screen and not only in a doc. */}
          Read-only preview. Authoring — the word-tap answer picker, foil-kernel
          params, prompt text and the POST to <code>/api/specs</code> — is not
          built yet.
        </p>
      </section>

      <ExplainTrace explanation={explanation} surah={surah} />
    </div>
  );
}
