"use client";

// THE MS GLOSS DRAFT WORKFLOW PANEL — the missing UI half of the new
// `Admin\GlossDraftsController` (build-plan step 27, M9). See
// `lib/admin/glossDrafts.ts`'s own header for why this is buildable without
// Firdaus's content ratification: the table ships empty, and this panel is
// the scaffold a human types INTO, not authored content of its own.
//
// draft -> reviewed -> (merged, REFUSED by the server at hash v1) — the same
// three-state workflow `GlossDraftsController::review` enforces. This panel
// renders exactly one review action per row and never offers a "merge"
// button: merging is unconditionally 422'd server-side until a named Malay
// reviewer exists (v3-D15), and a button that always fails is a dark
// pattern this build does not ship.
//
// EVERY DRAFTED FIELD IS A COORDINATE (surah/ayah/position, integers) OR FREE
// PROSE THE ADMIN TYPES — never a picker over corpus text, because this
// surface authors words that do not yet exist anywhere in the corpus. That is
// the one structural difference from `OverrideEditor` (which corrects an
// EXISTING corpus word, and therefore can offer a dropdown over it).

import { useCallback, useEffect, useState } from "react";
import {
  loadGlossDrafts,
  reviewGlossDraft,
  saveGlossDraft,
  type GlossDraftAuthorKind,
  type GlossDraftRow,
  type GlossDraftsLoad,
} from "@/lib/admin/glossDrafts";

/** The one language this workflow may author (`AUTHORABLE_LANGS` server-side)
 *  — `en` is an input to the qari-tier hash and the server refuses it
 *  unconditionally, so there is nothing to pick here. */
const LANG = "ms";

function isPositiveInt(raw: string): boolean {
  if (raw.trim() === "") return false;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 && String(n) === raw.trim();
}

export function GlossDraftsPanel() {
  const [surahDraft, setSurahDraft] = useState("12");
  const [surah, setSurah] = useState(12);
  const [load, setLoad] = useState<GlossDraftsLoad>({ state: "loading" });

  const [ayahDraft, setAyahDraft] = useState("");
  const [positionDraft, setPositionDraft] = useState("");
  const [textDraft, setTextDraft] = useState("");
  const [authorKind, setAuthorKind] = useState<GlossDraftAuthorKind>("human");
  const [noteDraft, setNoteDraft] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const [reviewBusyId, setReviewBusyId] = useState<number | null>(null);

  const refresh = useCallback((forSurah: number) => {
    setLoad({ state: "loading" });
    void (async () => setLoad(await loadGlossDrafts(forSurah, LANG)))();
  }, []);

  useEffect(() => {
    refresh(surah);
  }, [surah, refresh]);

  const onChooseSurah = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const parsed = Number.parseInt(surahDraft.trim(), 10);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 114) setSurah(parsed);
    },
    [surahDraft],
  );

  const onSubmitDraft = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!isPositiveInt(ayahDraft) || !isPositiveInt(positionDraft) || textDraft.trim().length === 0) return;
      setFormBusy(true);
      setFormMessage(null);
      void (async () => {
        const outcome = await saveGlossDraft({
          surah,
          ayah: Number.parseInt(ayahDraft, 10),
          position: Number.parseInt(positionDraft, 10),
          lang: LANG,
          text: textDraft.trim(),
          authorKind,
          note: noteDraft.trim() || undefined,
        });
        setFormBusy(false);
        if (outcome.state === "saved") {
          setTextDraft("");
          setNoteDraft("");
          setFormMessage(
            outcome.draft.status === "draft" && outcome.draft.reviewedAt === null
              ? "draft saved"
              : "draft saved — a previously reviewed row returns to draft on edit",
          );
          refresh(surah);
          return;
        }
        setFormMessage(outcome.reason);
      })();
    },
    [surah, ayahDraft, positionDraft, textDraft, authorKind, noteDraft, refresh],
  );

  const onReview = useCallback(
    (row: GlossDraftRow, toStatus: "reviewed" | "draft") => {
      setReviewBusyId(row.id);
      void (async () => {
        const outcome = await reviewGlossDraft(row.id, { toStatus, actorKind: "human" });
        setReviewBusyId(null);
        if (outcome.state === "updated") refresh(surah);
      })();
    },
    [surah, refresh],
  );

  return (
    <section className="card" aria-labelledby="gloss-drafts-h">
      <div className="card-header">
        <h2 id="gloss-drafts-h" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
          MS GLOSS DRAFTS
        </h2>
      </div>

      <p className="caption" role="status">
        Non-shipping. Nothing drafted or reviewed here reaches a learner, and it
        cannot move any ayah&apos;s verified frontier (v3-D15) —{" "}
        <code>gloss.ms</code> is excluded from hash v1, the digest that
        frontier is computed from. Merging into the serving corpus is closed
        until a named Malay reviewer with doctrinal authority exists.
      </p>

      <form onSubmit={onChooseSurah} className="stack" aria-label="Choose a surah">
        <label>
          Surah
          <input
            type="text"
            inputMode="numeric"
            value={surahDraft}
            onChange={(e) => setSurahDraft(e.target.value)}
          />
        </label>
        <button type="submit" className="btn">
          Load
        </button>
      </form>

      {load.state === "loading" ? <p className="caption">Loading…</p> : null}
      {load.state === "unavailable" ? (
        <p className="caption" role="alert">
          {load.reason}
        </p>
      ) : null}

      {load.state === "ready" ? (
        <>
          <p className="caption">
            Surah {load.surah}: {load.counts.draft} draft, {load.counts.reviewed} reviewed,{" "}
            {load.counts.merged} merged, {load.counts.unauthored} unauthored coordinate
            {load.counts.unauthored === 1 ? "" : "s"}.
          </p>

          {load.drafts.length === 0 ? (
            <p className="caption">No drafts yet for surah {load.surah}.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Ayah</th>
                  <th scope="col">Pos</th>
                  <th scope="col">Status</th>
                  <th scope="col">Text</th>
                  <th scope="col">Reviewed by</th>
                  <th scope="col">History</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {load.drafts.map((row) => (
                  <tr key={row.id}>
                    <td>{row.ayah}</td>
                    <td>{row.position}</td>
                    <td>{row.status}</td>
                    <td>{row.text ?? <em>(unauthored)</em>}</td>
                    <td>{row.reviewedBy ?? "—"}</td>
                    <td>
                      {row.reviews && row.reviews.length > 0 ? (
                        <details>
                          <summary>
                            {row.reviews.length} review{row.reviews.length === 1 ? "" : "s"}
                          </summary>
                          <ul>
                            {row.reviews.map((rev, i) => (
                              <li key={i}>
                                {rev.fromStatus} → {rev.toStatus} by {rev.actor ?? "—"}
                                {rev.note ? `: ${rev.note}` : ""}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </td>
                    <td>
                      {row.status === "draft" ? (
                        <button
                          type="button"
                          className="btn"
                          disabled={reviewBusyId === row.id || !row.text}
                          onClick={() => onReview(row, "reviewed")}
                        >
                          Mark reviewed
                        </button>
                      ) : null}
                      {row.status === "reviewed" ? (
                        <button
                          type="button"
                          className="btn"
                          disabled={reviewBusyId === row.id}
                          onClick={() => onReview(row, "draft")}
                        >
                          Reject to draft
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : null}

      <form onSubmit={onSubmitDraft} className="stack" aria-label="Draft a gloss">
        <h3 style={{ fontSize: 12, fontWeight: 600 }}>Draft a gloss (Malay)</h3>
        <label>
          Ayah
          <input type="text" inputMode="numeric" value={ayahDraft} onChange={(e) => setAyahDraft(e.target.value)} />
        </label>
        <label>
          Word position
          <input
            type="text"
            inputMode="numeric"
            value={positionDraft}
            onChange={(e) => setPositionDraft(e.target.value)}
          />
        </label>
        <label>
          Text
          <textarea value={textDraft} onChange={(e) => setTextDraft(e.target.value)} />
        </label>
        <label>
          Authored by
          <select value={authorKind} onChange={(e) => setAuthorKind(e.target.value as GlossDraftAuthorKind)}>
            <option value="human">a human</option>
            <option value="ai">an AI draft, pending human review</option>
          </select>
        </label>
        <label>
          Note (optional)
          <input type="text" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
        </label>
        <button
          type="submit"
          className="btn"
          disabled={formBusy || !isPositiveInt(ayahDraft) || !isPositiveInt(positionDraft) || textDraft.trim().length === 0}
        >
          Save draft
        </button>
        {formMessage ? (
          <p className="caption" role="status">
            {formMessage}
          </p>
        ) : null}
      </form>
    </section>
  );
}
