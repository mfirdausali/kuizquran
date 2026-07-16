// v2-D17/D21/D22/D54/D57/ROADMAP Phase 6 — the operator admin console: §3
// metrics + per-user drill-down (ported from v1's admin.ts), the verified-
// frontier-vs-learner-frontier metric (v2-D30), and the qari-friendly
// question-bank override editor (v2-D21/D22). Deliberately separate from the
// learner-facing Progress Report (v2-D17: "never merge them") — different
// route, different audience, no shared component beyond the design system.
// Gated server-side by ADMIN_EMAILS (v2-D54); this page itself just surfaces
// a plain "you're not an admin" message on a 403 rather than pretending to be
// a real access-control boundary (the boundary is the API).
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Corpus, CorpusWord } from "engine";
import { wordGloss, distractorsFor } from "engine";
import { loadCorpus } from "../corpus/loadCorpus.ts";
import { me } from "../sync/auth.ts";
import "./admin.css";
import {
  AdminApiError,
  createOverride,
  fetchFrontier,
  fetchMetrics,
  fetchUser,
  fetchUsers,
  fetchVerifications,
  markVerified,
  type AdminUserSummary,
  type ConfusionPair,
  type Frontier,
  type Metric,
  type UserDrillDown,
  type VerificationRow,
} from "./api.ts";

const SURAH = 12;
type Tab = "metrics" | "users" | "frontier" | "overrides";

function ErrorBanner({ err }: { err: unknown }) {
  const msg = err instanceof AdminApiError ? err.message : String(err);
  const isAuth = err instanceof AdminApiError && (err.status === 401 || err.status === 403);
  return (
    <div className="banner banner--warn">
      <p>{isAuth ? "You're not signed in as an admin." : `Failed: ${msg}`}</p>
      {isAuth && <p className="sub">Sign in on the Home screen with an ADMIN_EMAILS-allow-listed account.</p>}
    </div>
  );
}

function MetricsPanel() {
  const [metrics, setMetrics] = useState<Metric[] | null>(null);
  const [pairs, setPairs] = useState<ConfusionPair[]>([]);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    fetchMetrics()
      .then((r) => {
        setMetrics(r.metrics);
        setPairs(r.confusionPairs);
      })
      .catch(setErr);
  }, []);

  if (err) return <ErrorBanner err={err} />;
  if (!metrics) return <p className="voice">Loading…</p>;

  return (
    <>
      <div className="card">
        <div className="card-header">
          <span>§3 metrics</span>
          <span className="caption">live, read-only</span>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
              <th>Target</th>
              <th>n</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.key}>
                <td>{m.label}</td>
                <td>{m.value ?? <span className="caption">— {m.note}</span>}</td>
                <td className="caption">{m.target}</td>
                <td className="caption">{m.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="card-header">
          <span>Top confusion pairs</span>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Ayah:pos</th>
              <th>Chosen instead</th>
              <th>×</th>
            </tr>
          </thead>
          <tbody>
            {pairs.length === 0 && (
              <tr>
                <td className="caption" colSpan={3}>
                  no slips recorded
                </td>
              </tr>
            )}
            {pairs.map((p) => (
              <tr key={`${p.ayah}:${p.position}:${p.chosen}`}>
                <td>
                  {SURAH}:{p.ayah}·{p.position}
                </td>
                <td className="option--arabic-inline">{p.chosen}</td>
                <td className="caption">{p.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [selected, setSelected] = useState<UserDrillDown | null>(null);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    fetchUsers()
      .then((r) => setUsers(r.users))
      .catch(setErr);
  }, []);

  if (err) return <ErrorBanner err={err} />;
  if (!users) return <p className="voice">Loading…</p>;

  return (
    <>
      <div className="card">
        <div className="card-header">
          <span>Users</span>
          <span className="caption">{users.length}</span>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Learner</th>
              <th>Events</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <button className="btn btn--ghost" onClick={() => void fetchUser(u.id).then(setSelected).catch(setErr)}>
                    {u.email ?? `anonymous device #${u.id}`}
                  </button>
                </td>
                <td className="caption">{u.events}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="card">
          <div className="card-header">
            <span>{selected.email ?? `anonymous device #${selected.id}`}</span>
            <span className="caption">user {selected.id}</span>
          </div>
          <table className="admin-table">
            <tbody>
              <tr>
                <td>Ayat encoded</td>
                <td>{selected.ayatEncoded}</td>
              </tr>
              <tr>
                <td>Cold gates</td>
                <td>
                  {selected.gatesPassed} / {selected.gatesTotal} passed
                </td>
              </tr>
              <tr>
                <td>Avg time-per-word</td>
                <td>{selected.avgLatencyMs != null ? `${(selected.avgLatencyMs / 1000).toFixed(1)} s` : "—"}</td>
              </tr>
              <tr>
                <td>Active learning-days</td>
                <td>{selected.activeDays}</td>
              </tr>
            </tbody>
          </table>
          <p className="card-header">
            <span>Weak spots</span>
          </p>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ayah:pos</th>
                <th>Chosen instead</th>
                <th>×</th>
              </tr>
            </thead>
            <tbody>
              {selected.confusionPairs.length === 0 && (
                <tr>
                  <td className="caption" colSpan={3}>
                    no slips recorded
                  </td>
                </tr>
              )}
              {selected.confusionPairs.map((p) => (
                <tr key={`${p.ayah}:${p.position}:${p.chosen}`}>
                  <td>
                    {SURAH}:{p.ayah}·{p.position}
                  </td>
                  <td className="option--arabic-inline">{p.chosen}</td>
                  <td className="caption">{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function FrontierPanel({ corpus }: { corpus: Corpus | null }) {
  const [frontier, setFrontier] = useState<Frontier | null>(null);
  const [verifications, setVerifications] = useState<VerificationRow[]>([]);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  function refresh() {
    if (!corpus) return;
    fetchFrontier(SURAH, corpus.meta.ayahCount).then(setFrontier).catch(setErr);
    fetchVerifications(SURAH).then((r) => setVerifications(r.verifications)).catch(setErr);
  }

  useEffect(refresh, [corpus]);

  async function verifyThrough() {
    if (!corpus || !frontier) return;
    const n = Math.min(Number(target), corpus.meta.ayahCount);
    if (!Number.isInteger(n) || n <= frontier.verifiedThrough) return;
    setBusy(true);
    const verifiedSet = new Set(verifications.map((v) => v.ayah));
    for (let a = 1; a <= n; a++) {
      if (!verifiedSet.has(a)) await markVerified(SURAH, a).catch(setErr);
    }
    setBusy(false);
    setTarget("");
    refresh();
  }

  if (err) return <ErrorBanner err={err} />;
  if (!frontier) return <p className="voice">Loading…</p>;

  const behind = frontier.bufferAyat <= 0 && frontier.learnerFrontier > 0;

  return (
    <div className="card">
      <div className="card-header">
        <span>Verified frontier vs. learner frontier</span>
        <span className="caption">GATE-A (v2-D30)</span>
      </div>
      <p className="voice">
        Verified through <strong>{SURAH}:{frontier.verifiedThrough}</strong> · fastest learner has reached{" "}
        <strong>{SURAH}:{frontier.learnerFrontier}</strong> · buffer {frontier.bufferAyat} ayat.
      </p>
      {behind && (
        <div className="banner banner--warn">
          <p>A learner has reached or passed the verified frontier — verify ahead before more learners catch up.</p>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label className="caption">
          Mark verified through ayah{" "}
          <input
            type="number"
            min={frontier.verifiedThrough + 1}
            max={frontier.ayahCount}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            style={{ width: 64 }}
          />
        </label>
        <button className="btn btn--primary" disabled={busy || !target} onClick={() => void verifyThrough()}>
          {busy ? "Verifying…" : "Verify"}
        </button>
      </div>
      <p className="caption">{verifications.length} of {frontier.ayahCount} ayat verified overall (gaps allowed; only an unbroken prefix from ayah 1 counts toward the frontier).</p>
    </div>
  );
}

type PayloadState =
  | { field: "gloss"; lang: "en" | "ms"; text: string }
  | { field: "distractor"; distractors: string[] }
  | { field: "disable"; disabled: boolean }
  | { field: "group"; groupWith: number[] }
  | { field: "custom"; prompt: string; options: string[]; correct: string };

function defaultPayload(field: PayloadState["field"]): PayloadState {
  switch (field) {
    case "gloss":
      return { field, lang: "en", text: "" };
    case "distractor":
      return { field, distractors: [""] };
    case "disable":
      return { field, disabled: true };
    case "group":
      return { field, groupWith: [] };
    case "custom":
      return { field, prompt: "", options: ["", ""], correct: "" };
  }
}

function OverridesPanel({ corpus }: { corpus: Corpus | null }) {
  const [ayah, setAyah] = useState(1);
  const [position, setPosition] = useState<number | "">("");
  const [questionType, setQuestionType] = useState("S1");
  const [payload, setPayload] = useState<PayloadState>(defaultPayload("gloss"));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const words: CorpusWord[] = useMemo(
    () => (corpus ? corpus.words.filter((w) => w.ayah === ayah).sort((a, b) => a.position - b.position) : []),
    [corpus, ayah],
  );
  const selectedWord = words.find((w) => w.position === position) ?? null;

  useEffect(() => {
    if (payload.field === "gloss" && selectedWord) {
      setPayload({ field: "gloss", lang: "en", text: wordGloss(selectedWord, "en") });
    }
    if (payload.field === "distractor" && corpus && position !== "") {
      const current = distractorsFor(corpus, ayah, position).map((d) => d.text);
      setPayload({ field: "distractor", distractors: current.length > 0 ? current : [""] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWord?.position, ayah]);

  async function submit() {
    if (!corpus) return;
    setBusy(true);
    setErr(null);
    try {
      let wirePayload: unknown;
      if (payload.field === "gloss") wirePayload = { lang: payload.lang, text: payload.text };
      else if (payload.field === "distractor") {
        wirePayload = {
          distractors: payload.distractors
            .filter((t) => t.trim() !== "")
            .map((text, i) => ({ text, rank: i + 1, prd_rank: "custom", src_type: "custom", why: "qari-curated" })),
        };
      } else if (payload.field === "disable") wirePayload = { disabled: payload.disabled };
      else if (payload.field === "group") wirePayload = { groupWith: payload.groupWith };
      else wirePayload = { prompt: payload.prompt, options: payload.options.filter((o) => o !== ""), correct: payload.correct };

      await createOverride({
        surah: SURAH,
        ayah,
        position: position === "" ? null : position,
        questionType,
        field: payload.field,
        payload: wirePayload,
        note: note || undefined,
      });
      setSavedAt(Date.now());
      setNote("");
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <span>Question-bank override editor</span>
        <span className="caption">v2-D21/D22</span>
      </div>
      <p className="voice">Fix a gloss, curate distractors, or disable a bad question — every edit is append-only and applies at question-build time, no corpus rebuild.</p>

      {err !== null && <ErrorBanner err={err} />}
      {savedAt && <div className="banner banner--ok"><p>Saved — this correction now wins over the generated question.</p></div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label className="caption">
          Ayah{" "}
          <input type="number" min={1} max={corpus?.meta.ayahCount ?? 111} value={ayah} onChange={(e) => { setAyah(Number(e.target.value)); setPosition(""); }} style={{ width: 56 }} />
        </label>
        <label className="caption">
          Question type{" "}
          <select value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
            {["S1", "S2", "S3", "S4", "RC", "vocab", "cloze", "junction", "locate", "reorder", "produce"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="caption">
          Field{" "}
          <select value={payload.field} onChange={(e) => setPayload(defaultPayload(e.target.value as PayloadState["field"]))}>
            <option value="gloss">Fix meaning (gloss)</option>
            <option value="distractor">Curate wrong-answer options</option>
            <option value="disable">Disable this question</option>
            <option value="group">Group multi-word phrase</option>
            <option value="custom">Add a custom question</option>
          </select>
        </label>
      </div>

      {words.length > 0 && (
        <div className="ayah" style={{ marginTop: 8 }}>
          {words.map((w) => (
            <button
              key={w.position}
              className={"option" + (position === w.position ? " is-ok" : "")}
              style={{ fontFamily: "var(--font-arabic)", marginInlineEnd: 4 }}
              onClick={() => setPosition(w.position)}
            >
              {w.text_uthmani}
            </button>
          ))}
        </div>
      )}
      {selectedWord && <p className="caption">Currently: "{selectedWord.text_uthmani}" · gloss(en): {wordGloss(selectedWord, "en")}</p>}

      {payload.field === "gloss" && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <select value={payload.lang} onChange={(e) => setPayload({ ...payload, lang: e.target.value as "en" | "ms" })}>
            <option value="en">English</option>
            <option value="ms">Bahasa Melayu</option>
          </select>
          <input type="text" value={payload.text} onChange={(e) => setPayload({ ...payload, text: e.target.value })} placeholder="corrected meaning" style={{ flex: 1 }} />
        </div>
      )}

      {payload.field === "distractor" && (
        <div style={{ marginTop: 8 }}>
          {payload.distractors.map((d, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              <input
                type="text"
                value={d}
                dir="rtl"
                style={{ fontFamily: "var(--font-arabic)", flex: 1 }}
                onChange={(e) => {
                  const next = payload.distractors.slice();
                  next[i] = e.target.value;
                  setPayload({ ...payload, distractors: next });
                }}
              />
              <button className="btn btn--ghost" onClick={() => setPayload({ ...payload, distractors: payload.distractors.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button className="btn btn--ghost" onClick={() => setPayload({ ...payload, distractors: [...payload.distractors, ""] })}>
            + add option
          </button>
        </div>
      )}

      {payload.field === "disable" && (
        <label className="caption" style={{ display: "block", marginTop: 8 }}>
          <input type="checkbox" checked={payload.disabled} onChange={(e) => setPayload({ ...payload, disabled: e.target.checked })} /> Disabled
        </label>
      )}

      {payload.field === "group" && (
        <div style={{ marginTop: 8 }}>
          <p className="caption">Group with:</p>
          {words.filter((w) => w.position !== position).map((w) => (
            <label key={w.position} className="caption" style={{ display: "inline-flex", gap: 4, marginInlineEnd: 8 }}>
              <input
                type="checkbox"
                checked={payload.groupWith.includes(w.position)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...payload.groupWith, w.position]
                    : payload.groupWith.filter((p) => p !== w.position);
                  setPayload({ ...payload, groupWith: next });
                }}
              />
              {w.text_uthmani}
            </label>
          ))}
        </div>
      )}

      {payload.field === "custom" && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <input type="text" placeholder="prompt" value={payload.prompt} onChange={(e) => setPayload({ ...payload, prompt: e.target.value })} />
          {payload.options.map((o, i) => (
            <div key={i} style={{ display: "flex", gap: 6 }}>
              <input
                type="text"
                placeholder={`option ${i + 1}`}
                value={o}
                onChange={(e) => {
                  const next = payload.options.slice();
                  next[i] = e.target.value;
                  setPayload({ ...payload, options: next });
                }}
              />
              <label className="caption">
                <input type="radio" name="correct" checked={payload.correct === o && o !== ""} onChange={() => setPayload({ ...payload, correct: o })} /> correct
              </label>
            </div>
          ))}
          <button className="btn btn--ghost" onClick={() => setPayload({ ...payload, options: [...payload.options, ""] })}>+ add option</button>
        </div>
      )}

      <input type="text" placeholder="note (why this correction — audit trail)" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: "100%", marginTop: 8 }} />

      <button className="btn btn--primary" style={{ marginTop: 8 }} disabled={busy || !corpus} onClick={() => void submit()}>
        {busy ? "Saving…" : "Save override"}
      </button>
    </div>
  );
}

export function Admin() {
  const [tab, setTab] = useState<Tab>("metrics");
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    loadCorpus(SURAH).then(setCorpus).catch(() => setCorpus(null));
    void me().then((info) => setSignedIn(info?.signedIn ?? false));
  }, []);

  return (
    <div className="screen">
      <div className="card">
        <div className="card-header">
          <span>iman · admin</span>
          <Link className="btn btn--ghost" to="/">← app</Link>
        </div>
        {signedIn === false && (
          <div className="banner banner--warn">
            <p>Not signed in. Sign in on Home with an ADMIN_EMAILS-allow-listed account first.</p>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["metrics", "users", "frontier", "overrides"] as Tab[]).map((t) => (
            <button key={t} className={"btn" + (tab === t ? " btn--primary" : " btn--ghost")} onClick={() => setTab(t)}>
              {t[0]!.toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {tab === "metrics" && <MetricsPanel />}
      {tab === "users" && <UsersPanel />}
      {tab === "frontier" && <FrontierPanel corpus={corpus} />}
      {tab === "overrides" && <OverridesPanel corpus={corpus} />}
    </div>
  );
}
