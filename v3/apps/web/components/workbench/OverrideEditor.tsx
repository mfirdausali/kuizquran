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
// SCOPED TO TWO OF THE FOUR OVERRIDE FIELDS, ON PURPOSE. `gloss` (an
// English/Malay text correction) and `disable` (a boolean toggle over an
// EXISTING word position, chosen from a dropdown — never typed) both need no
// free-typed Arabic. `distractor`'s payload is a full replacement
// `CorpusDistractor[]` set, which carries a raw Arabic `text` field — writing
// a free-text box for that would be the exact shape `WorkbenchIsland`'s own
// header already refuses for the spec editor's answer picker ("cannot type
// Arabic into any answer field — no such field exists... ship the picker
// with its CorpusRef plumbing intact, not a text input now"). `group` is a
// smaller, rarer editing surface (multi-word idiom grouping) deferred
// alongside it. Both remain real, separate, future work — not silently
// dropped.
//
// NO ARABIC IS WRITTEN HERE. `words[].text_uthmani` is read back OUT of the
// corpus prop the server component already loaded (same discipline as
// `lib/test/build.ts`'s own header) — this file supplies not one byte of its
// own; it only reads position numbers, language codes and free EN/MS prose
// the admin types into the gloss field (never Arabic).

import { useCallback, useEffect, useState } from "react";
import type { CorpusWord } from "@engine/types.ts";
import type { QuestionOverride } from "@engine/overrides.ts";
import { fetchOverrides } from "@/lib/overrides/fetch.ts";
import { disableOverride, glossOverride, submitOverride } from "@/lib/overrides/write.ts";

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
}

function isDisabledPayload(v: unknown): v is { disabled?: boolean } {
  return typeof v === "object" && v !== null;
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
  if (o.field === "group") return `group @${o.position ?? "-"}`;
  return o.field;
}

/** Whether a listed `disable` row is CURRENTLY active — the same latest-row
 *  reading `isQuestionDisabled` applies, but this list is per-ayah and small
 *  enough to read directly rather than importing the engine's map-building. */
function isActiveDisable(o: QuestionOverride): boolean {
  return o.field === "disable" && (!isDisabledPayload(o.payload) || o.payload.disabled !== false);
}

export function OverrideEditor({ surah, ayah, words }: OverrideEditorProps) {
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
        setGlossMessage("gloss corrected");
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
        setDisableMessage("disabled");
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
              <span className="caption">{summarize(o)}</span>{" "}
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
    </section>
  );
}
