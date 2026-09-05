"use client";

// THE OVERRIDE EDITOR (build-plan step 15's admin write path, wired here for
// the first time — DECISIONS.md v3-D125).
//
// `OverridesController::store` has existed, admin-gated and fully tested,
// since the override layer shipped; `POST /api/overrides` had zero frontend
// callers anywhere in `apps/web` — `grep -rn "apiFetch(\"/api/overrides\""
// apps/web` found only the GET the learner corpus loader makes
// (`lib/overrides/fetch.ts`). An admin or qari sitting at `/workbench` could
// SEE a wrong gloss (`ExplainTrace`) and SIGN an ayah's verification
// (`QariMode`) but had no way to actually correct the thing they were
// looking at. This panel is that missing write surface.
//
// ALL FOUR OVERRIDE FIELDS. `gloss` (an English/Malay text correction),
// `disable` (a boolean toggle over an existing word position, chosen from
// a dropdown — never typed), `distractor` (a full replacement
// `CorpusDistractor[]` set) and, as of this run, `group` (multi-word idiom
// grouping) all need no free-typed Arabic. `distractor`'s payload carries a
// raw Arabic `text` field per entry, which is why DECISIONS.md
// v3-D125/D126/D132 left it unbuilt — but the field does not require a
// FREE-TEXT box, only a picker: each replacement entry's `text` is read
// back OUT of an existing corpus word's own `text_uthmani`, exactly the
// discipline `glossOverride`/`disableOverride` already use for word
// POSITIONS below. A target-word dropdown (this ayah's own words) plus up
// to four replacement-word dropdowns (any word in the SURAH, so a visual/
// semantic/contextual substitute from elsewhere in the surah is choosable,
// not only same-ayah neighbours) build the full replacement set; nothing
// is typed. `group` is the SAME discipline over a narrower pool: an
// anchor-word dropdown plus up to `GROUP_SLOTS` "group with" dropdowns,
// both sourced from THIS AYAH's own `words` — `engine/overrides.ts
// #GroupPayload` has no cross-ayah member key, unlike distractor's
// whole-surah pool. Named deferred by DECISIONS.md v3-D126/D129/D130/D131
// ("a smaller, rarer surface... real separate future work"); closed here.
//
// NO ARABIC IS WRITTEN HERE. `words[].text_uthmani`/`surahWords[].text_uthmani`
// are read back OUT of the corpus prop the server component already loaded
// (same discipline as `lib/test/build.ts`'s own header) — this file
// supplies not one byte of its own; it only reads position numbers,
// language codes, and free EN/MS prose the admin types into the gloss
// field (never Arabic).
//
// WHO MADE EACH CORRECTION (v3-D163). `Override::editor()` existed since
// this table shipped; the list above showed WHAT changed and never WHO
// changed it — every row was indistinguishable from any other admin's.
// `editorEmail` is resolved server-side off `editorId`
// (`OverridesController::toWire()`) and rendered here, `"—"` when unknown
// (a pre-this-fix synced row, or a since-deleted editor account) — never a
// guess, matching `AyahVerification.verifiedBy`'s own display convention.
//
// WHY EACH CORRECTION (v3-D171). `QuestionOverride.note` has been fetched
// and typed since this table shipped (`OverridesController::toWire()`'s own
// `'note' => $r->note`) but the list above never rendered it — the same
// "written, wire-carried, zero read surface" shape this build has closed
// repeatedly on sibling review-history surfaces. An admin's own reasoning
// for a correction was recorded and then invisible to the next admin
// reviewing the same ayah. Rendered here, `"—"` for a null note, matching
// this file's own established convention.
//
// WHETHER THE VERIFICATION HASH ACTUALLY RECOMPUTED. `OverridesController
// ::store()` runs `CorpusHashRecomputer::recompute()` synchronously on every
// write (v3-D81, DEFECTS.md#B3's live-wiring closure) and returns its own
// verdict — `{ok:bool, error?:string}` — on every 201, but `submitOverride`
// discarded it and every success message here was a flat "gloss corrected"/
// "disabled"/etc. regardless. A recompute can genuinely fail (the surah was
// never compiled, the node subprocess errored) WITHOUT failing the write
// itself, by design — so an admin correcting a not-yet-compiled surah saw
// the identical success message a genuinely-recomputed correction gets,
// with no way to learn the tiered hash did not move: a previously-`verified`
// ayah could keep reading `verified` on the workbench frontier instead of
// `stale`, the exact failure mode B3 exists to prevent, re-opened silently
// on this one client. Each success message now appends a WARNING suffix
// when `hashRecompute.ok` is false, naming the server's own reported reason
// — never replacing the success message, since the write did succeed.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CorpusWord } from "@engine/types.ts";
import type { QuestionOverride } from "@engine/overrides.ts";
import { fetchOverrides } from "@/lib/overrides/fetch.ts";
import {
  disableOverride,
  distractorOverride,
  glossOverride,
  groupOverride,
  submitOverride,
  type HashRecomputeOutcome,
} from "@/lib/overrides/write.ts";

/** How many replacement distractors the picker offers. Matches
 *  `options.ts#options()`'s widest eligible pool — the Learn band accepts
 *  distractors up to `rank: 4` before slicing to the 3 it actually shows —
 *  so a fourth slot is never wasted capacity for any real strength band. */
const DISTRACTOR_SLOTS = 4;

/** How many "group with" picks the grouping picker offers. Idioms in the
 *  launch corpus are short (2-3 words); a fourth-plus-anchor member would be
 *  an unusual shape, so this stays smaller than `DISTRACTOR_SLOTS` rather
 *  than matching it by default. */
const GROUP_SLOTS = 3;

/** Mirrors `lib/test/build.ts#TestItemKind` — the actual set `isQuestionDisabled`
 *  is checked against at the one real consumer (a learner's Test route). */
const DISABLE_KINDS = ["vocab", "cloze", "junction", "locate", "produce", "reorder"] as const;
type DisableKind = (typeof DISABLE_KINDS)[number];

type PositionChoice = number | "";

export interface OverrideEditorProps {
  surah: number;
  ayah: number;
  /** Already filtered to this ayah by the caller (`WorkbenchIsland`). */
  words: readonly CorpusWord[];
  /** The WHOLE surah's words — the distractor picker's replacement pool.
   *  Never filtered to this ayah: a visual/semantic/contextual substitute
   *  is as likely to come from elsewhere in the surah as from the same
   *  ayah, and `CorpusWord.position` is only unique WITHIN an ayah, so
   *  candidates here are always keyed `${ayah}:${position}`. */
  surahWords: readonly CorpusWord[];
}

function isDisabledPayload(v: unknown): v is { disabled?: boolean } {
  return typeof v === "object" && v !== null;
}

function isDistractorListPayload(v: unknown): v is { distractors: unknown[] } {
  return typeof v === "object" && v !== null && Array.isArray((v as { distractors?: unknown }).distractors);
}

function isGroupWithPayload(v: unknown): v is { groupWith: unknown[] } {
  return typeof v === "object" && v !== null && Array.isArray((v as { groupWith?: unknown }).groupWith);
}

function summarize(o: QuestionOverride): string {
  if (o.field === "gloss") {
    const p = o.payload;
    const lang = isDisabledPayload(p) && "lang" in p ? String((p as { lang?: unknown }).lang) : "?";
    const text = isDisabledPayload(p) && "text" in p ? String((p as { text?: unknown }).text) : "";
    return `gloss (${lang}) @${o.position ?? "-"}: "${text}"`;
  }
  if (o.field === "disable") {
    const disabled = isDisabledPayload(o.payload) ? o.payload.disabled !== false : true;
    const scope = o.position != null ? `@${o.position}` : "(ayah-wide)";
    return `${disabled ? "disabled" : "re-enabled"} ${o.questionType} ${scope}`;
  }
  if (o.field === "distractor") {
    const count = isDistractorListPayload(o.payload) ? o.payload.distractors.length : 0;
    return `distractor @${o.position ?? "-"}: ${count} replacement${count === 1 ? "" : "s"}`;
  }
  if (o.field === "group") {
    const members = isGroupWithPayload(o.payload) ? o.payload.groupWith.length : 0;
    return `group @${o.position ?? "-"} + ${members} word${members === 1 ? "" : "s"}`;
  }
  return o.field;
}

/** `CorpusHashRecomputer::recompute()`'s own verdict (v3-D81), surfaced —
 *  the write itself always succeeds regardless of this outcome, but a
 *  `false` means the surah's tiered verification hash did NOT move, so a
 *  previously-`verified` ayah may still incorrectly read `verified` on the
 *  workbench frontier until a human re-runs `corpus:ingest-hashes` by hand.
 *  Appended to the plain success message, never replacing it — the write
 *  DID succeed. */
function hashRecomputeWarning(h: HashRecomputeOutcome): string {
  if (h.ok) return "";
  return ` — WARNING: the verification hash did not recompute (${h.error ?? "unknown reason"}) — this ayah's frontier may still show a stale "verified" status`;
}

/** Whether a listed `disable` row is CURRENTLY active — the same latest-row
 *  reading `isQuestionDisabled` applies, but this list is per-ayah and small
 *  enough to read directly rather than importing the engine's map-building. */
function isActiveDisable(o: QuestionOverride): boolean {
  return o.field === "disable" && (!isDisabledPayload(o.payload) || o.payload.disabled !== false);
}

export function OverrideEditor({ surah, ayah, words, surahWords }: OverrideEditorProps) {
  const [rows, setRows] = useState<QuestionOverride[] | null>(null);

  const [glossPosition, setGlossPosition] = useState<PositionChoice>("");
  const [glossLang, setGlossLang] = useState<"en" | "ms">("en");
  const [glossText, setGlossText] = useState("");
  const [glossNote, setGlossNote] = useState("");
  const [glossBusy, setGlossBusy] = useState(false);
  const [glossMessage, setGlossMessage] = useState<string | null>(null);

  const [disableScope, setDisableScope] = useState<"ayah" | "position">("ayah");
  const [disablePosition, setDisablePosition] = useState<PositionChoice>("");
  const [disableKind, setDisableKind] = useState<DisableKind>("vocab");
  const [disableNote, setDisableNote] = useState("");
  const [disableBusy, setDisableBusy] = useState(false);
  const [disableMessage, setDisableMessage] = useState<string | null>(null);

  const [distractorTarget, setDistractorTarget] = useState<PositionChoice>("");
  const [distractorPicks, setDistractorPicks] = useState<string[]>(() => Array(DISTRACTOR_SLOTS).fill(""));
  const [distractorNote, setDistractorNote] = useState("");
  const [distractorBusy, setDistractorBusy] = useState(false);
  const [distractorMessage, setDistractorMessage] = useState<string | null>(null);

  const [groupAnchor, setGroupAnchor] = useState<PositionChoice>("");
  const [groupPicks, setGroupPicks] = useState<string[]>(() => Array(GROUP_SLOTS).fill(""));
  const [groupNote, setGroupNote] = useState("");
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupMessage, setGroupMessage] = useState<string | null>(null);

  // The replacement pool: every surah word EXCEPT the one currently being
  // replaced — offering a word as its own distractor would be a
  // self-defeating correction, and `distractorsFor`'s own consumers
  // (`options.ts#pickOptions`) already filter `d.text !== correct`.
  const distractorCandidates = useMemo(
    () => surahWords.filter((w) => !(w.ayah === ayah && w.position === distractorTarget)),
    [surahWords, ayah, distractorTarget],
  );

  // Same-ayah only — `GroupPayload#groupWith` has no cross-ayah member key,
  // unlike distractor's whole-surah `surahWords` pool above.
  const groupCandidates = useMemo(
    () => words.filter((w) => w.position !== groupAnchor),
    [words, groupAnchor],
  );

  const refresh = useCallback(() => {
    void (async () => {
      const all = await fetchOverrides(surah);
      setRows(all.filter((o) => o.ayah === ayah));
    })();
  }, [surah, ayah]);

  useEffect(() => {
    setRows(null);
    refresh();
  }, [refresh]);

  const onSubmitGloss = useCallback(() => {
    if (glossPosition === "" || glossText.trim().length === 0) return;
    setGlossBusy(true);
    setGlossMessage(null);
    void (async () => {
      const outcome = await submitOverride(
        glossOverride(surah, ayah, glossPosition, glossLang, glossText.trim(), glossNote.trim() || undefined),
      );
      setGlossBusy(false);
      if (outcome.state === "created") {
        setGlossText("");
        setGlossNote("");
        setGlossMessage("gloss corrected" + hashRecomputeWarning(outcome.hashRecompute));
        refresh();
        return;
      }
      setGlossMessage(outcome.reason);
    })();
  }, [surah, ayah, glossPosition, glossLang, glossText, glossNote, refresh]);

  const onSubmitDisable = useCallback(() => {
    const position = disableScope === "position" ? disablePosition : null;
    if (disableScope === "position" && position === "") return;
    setDisableBusy(true);
    setDisableMessage(null);
    void (async () => {
      const outcome = await submitOverride(
        disableOverride(surah, ayah, position === "" ? null : position, disableKind, true, disableNote.trim() || undefined),
      );
      setDisableBusy(false);
      if (outcome.state === "created") {
        setDisableNote("");
        setDisableMessage("disabled" + hashRecomputeWarning(outcome.hashRecompute));
        refresh();
        return;
      }
      setDisableMessage(outcome.reason);
    })();
  }, [surah, ayah, disableScope, disablePosition, disableKind, disableNote, refresh]);

  const onReEnable = useCallback(
    (o: QuestionOverride) => {
      void (async () => {
        const outcome = await submitOverride(
          disableOverride(surah, o.ayah, o.position, o.questionType, false, "re-enabled from workbench"),
        );
        if (outcome.state === "created") refresh();
      })();
    },
    [surah, refresh],
  );

  const onSubmitDistractor = useCallback(() => {
    if (distractorTarget === "") return;
    // Rank = pick order, matching `distractorsFor`'s own "sorted by rank
    // ascending" contract — the FIRST slot filled is the strongest
    // (lowest-rank, most-often-served) distractor, not necessarily slot 1
    // literally, since an admin may leave an earlier slot empty.
    const chosen = distractorPicks
      .filter((key) => key !== "")
      .map((key) => {
        const [a, p] = key.split(":").map(Number);
        return surahWords.find((w) => w.ayah === a && w.position === p);
      })
      .filter((w): w is CorpusWord => w != null);
    if (chosen.length === 0) return;
    setDistractorBusy(true);
    setDistractorMessage(null);
    void (async () => {
      const outcome = await submitOverride(
        distractorOverride(
          surah,
          ayah,
          distractorTarget,
          chosen.map((w, i) => ({
            rank: i + 1,
            text: w.text_uthmani,
            prd_rank: "override",
            src_type: "admin",
            why: "admin-selected replacement",
          })),
          distractorNote.trim() || undefined,
        ),
      );
      setDistractorBusy(false);
      if (outcome.state === "created") {
        setDistractorPicks(Array(DISTRACTOR_SLOTS).fill(""));
        setDistractorNote("");
        setDistractorMessage("distractors replaced" + hashRecomputeWarning(outcome.hashRecompute));
        refresh();
        return;
      }
      setDistractorMessage(outcome.reason);
    })();
  }, [surah, ayah, distractorTarget, distractorPicks, distractorNote, surahWords, refresh]);

  const onSubmitGroup = useCallback(() => {
    if (groupAnchor === "") return;
    const members = groupPicks
      .filter((v) => v !== "")
      .map(Number)
      .filter((n) => !Number.isNaN(n));
    if (members.length === 0) return;
    setGroupBusy(true);
    setGroupMessage(null);
    void (async () => {
      const outcome = await submitOverride(groupOverride(surah, ayah, groupAnchor, members, groupNote.trim() || undefined));
      setGroupBusy(false);
      if (outcome.state === "created") {
        setGroupPicks(Array(GROUP_SLOTS).fill(""));
        setGroupNote("");
        setGroupMessage("words grouped" + hashRecomputeWarning(outcome.hashRecompute));
        refresh();
        return;
      }
      setGroupMessage(outcome.reason);
    })();
  }, [surah, ayah, groupAnchor, groupPicks, groupNote, refresh]);

  return (
    <section className="card" aria-labelledby="overrides-h">
      <div className="card-header">
        <h2 id="overrides-h" className="wb-h">
          OVERRIDES
        </h2>
      </div>

      {rows === null ? (
        <p className="caption">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="caption">No overrides recorded for this ayah.</p>
      ) : (
        <ul className="stack stack--tight" data-testid="override-list">
          {rows.map((o) => (
            <li key={o.id ?? `${o.field}-${o.createdAt}`}>
              <span className="caption">
                {summarize(o)} — by {o.editorEmail ?? "—"} — note: {o.note ?? "—"} —{" "}
                <span className="ltr-island">{new Date(o.createdAt).toISOString()}</span>
              </span>{" "}
              {isActiveDisable(o) ? (
                <button type="button" className="btn" onClick={() => onReEnable(o)}>
                  Re-enable
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <fieldset className="wb-field">
        <legend className="caption">Correct a gloss</legend>
        <label>
          Word
          <select
            value={glossPosition}
            onChange={(e) => setGlossPosition(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">Choose a word</option>
            {words.map((w) => (
              <option key={w.position} value={w.position}>
                #{w.position} {w.text_uthmani}
              </option>
            ))}
          </select>
        </label>
        <label>
          Language
          <select value={glossLang} onChange={(e) => setGlossLang(e.target.value as "en" | "ms")}>
            <option value="en">English</option>
            <option value="ms">Malay</option>
          </select>
        </label>
        <label>
          Corrected gloss
          <input type="text" value={glossText} onChange={(e) => setGlossText(e.target.value)} />
        </label>
        <label>
          Note (optional)
          <input type="text" value={glossNote} onChange={(e) => setGlossNote(e.target.value)} />
        </label>
        <button
          type="button"
          className="btn"
          onClick={onSubmitGloss}
          disabled={glossBusy || glossPosition === "" || glossText.trim().length === 0}
        >
          Submit gloss correction
        </button>
        {glossMessage ? (
          <p className="caption" role="status">
            {glossMessage}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="wb-field">
        <legend className="caption">Disable a question</legend>
        <div className="stack stack--tight">
          <label>
            <input
              type="radio"
              name="wb-disable-scope"
              checked={disableScope === "ayah"}
              onChange={() => setDisableScope("ayah")}
            />
            Whole ayah
          </label>
          <label>
            <input
              type="radio"
              name="wb-disable-scope"
              checked={disableScope === "position"}
              onChange={() => setDisableScope("position")}
            />
            One word
          </label>
        </div>
        {disableScope === "position" ? (
          <label>
            Word
            <select
              value={disablePosition}
              onChange={(e) => setDisablePosition(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Choose a word</option>
              {words.map((w) => (
                <option key={w.position} value={w.position}>
                  #{w.position} {w.text_uthmani}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          Question type
          <select value={disableKind} onChange={(e) => setDisableKind(e.target.value as DisableKind)}>
            {DISABLE_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label>
          Note (optional)
          <input type="text" value={disableNote} onChange={(e) => setDisableNote(e.target.value)} />
        </label>
        <button
          type="button"
          className="btn"
          onClick={onSubmitDisable}
          disabled={disableBusy || (disableScope === "position" && disablePosition === "")}
        >
          Disable
        </button>
        {disableMessage ? (
          <p className="caption" role="status">
            {disableMessage}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="wb-field">
        <legend className="caption">Replace distractors</legend>
        <label>
          Target word
          <select
            value={distractorTarget}
            onChange={(e) => setDistractorTarget(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">Choose a word</option>
            {words.map((w) => (
              <option key={w.position} value={w.position}>
                #{w.position} {w.text_uthmani}
              </option>
            ))}
          </select>
        </label>
        {Array.from({ length: DISTRACTOR_SLOTS }, (_, i) => i).map((i) => (
          <label key={i}>
            {`Replacement ${i + 1}`}
            <select
              value={distractorPicks[i]}
              onChange={(e) => {
                const next = [...distractorPicks];
                next[i] = e.target.value;
                setDistractorPicks(next);
              }}
            >
              <option value="">—</option>
              {distractorCandidates.map((w) => (
                <option key={`${w.ayah}:${w.position}`} value={`${w.ayah}:${w.position}`}>
                  {w.ayah}:{w.position} {w.text_uthmani}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Note (optional)
          <input type="text" value={distractorNote} onChange={(e) => setDistractorNote(e.target.value)} />
        </label>
        <button
          type="button"
          className="btn"
          onClick={onSubmitDistractor}
          disabled={distractorBusy || distractorTarget === "" || !distractorPicks.some((k) => k !== "")}
        >
          Replace distractors
        </button>
        {distractorMessage ? (
          <p className="caption" role="status">
            {distractorMessage}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="wb-field">
        <legend className="caption">Group words (idiom)</legend>
        <label>
          Anchor word
          <select
            value={groupAnchor}
            onChange={(e) => setGroupAnchor(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">Choose a word</option>
            {words.map((w) => (
              <option key={w.position} value={w.position}>
                #{w.position} {w.text_uthmani}
              </option>
            ))}
          </select>
        </label>
        {Array.from({ length: GROUP_SLOTS }, (_, i) => i).map((i) => (
          <label key={i}>
            {`Group with ${i + 1}`}
            <select
              value={groupPicks[i]}
              onChange={(e) => {
                const next = [...groupPicks];
                next[i] = e.target.value;
                setGroupPicks(next);
              }}
            >
              <option value="">—</option>
              {groupCandidates.map((w) => (
                <option key={w.position} value={w.position}>
                  #{w.position} {w.text_uthmani}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Note (optional)
          <input type="text" value={groupNote} onChange={(e) => setGroupNote(e.target.value)} />
        </label>
        <button
          type="button"
          className="btn"
          onClick={onSubmitGroup}
          disabled={groupBusy || groupAnchor === "" || !groupPicks.some((v) => v !== "")}
        >
          Group words
        </button>
        {groupMessage ? (
          <p className="caption" role="status">
            {groupMessage}
          </p>
        ) : null}
      </fieldset>
    </section>
  );
}
