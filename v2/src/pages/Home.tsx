// ROADMAP Phase 2 — the real session home: driven by assembleQueue (FR3 order:
// make-up → gate → review → learn), with pace as a first-class, persisted,
// mid-surah-editable mode (v2-D09). This is where v2-BUG-1 (pace dial
// decorative) and v2-BUG-2 (make-up recovery dead) get fixed live — see
// session/useSession.ts, which wires the real budgetMin and lastActiveDay into
// assembleQueue instead of the v1 hardcoded 8 / null.
import { useEffect, useState } from "react";
import { Link, useNavigate, type NavigateFunction } from "react-router-dom";
import type { Corpus, PaceMode, QueueItem } from "engine";
import { loadCorpus } from "../corpus/loadCorpus.ts";
import { useSession } from "../session/useSession.ts";
import { useOnboarding } from "../onboarding/useOnboarding.ts";
import { resetForNewLearner } from "../session/resetAccount.ts";
import { Account } from "../sync/Account.tsx";

const SURAH = 12; // v2 ships Yusuf only (v2-D29); the loader itself takes surah as a param.

const PACE_MODES: { mode: PaceMode; label: string; blurb: string }[] = [
  { mode: "steady", label: "Steady", blurb: "1 new ayah/day, reserved slot" },
  { mode: "sprint", label: "Sprint", blurb: "More new ayat, wider gate window" },
  { mode: "maintain", label: "Maintain", blurb: "Reviews + chains only, no new" },
];

const KIND_LABEL: Record<QueueItem["kind"], string> = {
  makeup: "Make-up",
  gate: "Gate check",
  review: "Review",
  learn: "Learn",
};

function routeFor(item: QueueItem): string {
  return item.kind === "gate" || item.kind === "makeup"
    ? `/gate?ayah=${item.ayah}`
    : `/drill?ayah=${item.ayah}`;
}

export function Home() {
  const navigate = useNavigate();
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onboardStatus = useOnboarding();

  useEffect(() => {
    loadCorpus(SURAH)
      .then(setCorpus)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  // First run (no local history, no cached placement) → onboarding before the
  // main session (ROADMAP Phase 3).
  useEffect(() => {
    if (onboardStatus === "needed") navigate("/onboarding", { replace: true });
  }, [onboardStatus, navigate]);

  if (error) {
    return (
      <div className="screen">
        <div className="banner banner--warn">
          <p>Corpus failed to load: {error}</p>
        </div>
      </div>
    );
  }

  if (!corpus || onboardStatus === "loading" || onboardStatus === "needed") {
    return (
      <div className="screen">
        <p className="voice">Loading…</p>
      </div>
    );
  }

  return <HomeSession corpus={corpus} navigate={navigate} />;
}

function HomeSession({ corpus, navigate }: { corpus: Corpus; navigate: NavigateFunction }) {
  const { loading, queue, current, mode, setMode } = useSession(corpus);
  const [switching, setSwitching] = useState(false);

  const counts = queue.reduce(
    (acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] ?? 0) + 1 }),
    {} as Record<QueueItem["kind"], number>,
  );
  const totalMin = queue.reduce((s, i) => s + i.estMin, 0);

  // v2-D12: no multi-profile yet — this is a local-only reset (wipes this
  // device's event log + settings) so a different learner on a shared device
  // doesn't corrupt the current one's progress. Two-tap: the browser confirm()
  // is the deliberate friction against an accidental tap.
  async function switchAccount() {
    if (!confirm("Switch account? This clears all progress on this device.")) return;
    setSwitching(true);
    await resetForNewLearner();
    navigate("/onboarding", { replace: true });
  }

  return (
    <div className="screen">
      <div className="card">
        <div className="card-header">
          <span>iman.app v2</span>
          <span>
            Surah {corpus.meta.surah} · {corpus.meta.ayahCount} ayat
          </span>
        </div>

        <p className="voice">Today&apos;s session — assembled in make-up → gate → review → learn order.</p>

        <div style={{ display: "flex", gap: "8px" }}>
          {PACE_MODES.map((p) => (
            <button
              key={p.mode}
              className={p.mode === mode ? "btn btn--primary" : "btn btn--ghost"}
              style={{ flex: 1 }}
              onClick={() => setMode(p.mode)}
              aria-pressed={p.mode === mode}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="caption">{PACE_MODES.find((p) => p.mode === mode)!.blurb}</p>

        {loading && <p className="voice">Assembling today&apos;s queue…</p>}

        {!loading && queue.length === 0 && (
          <div className="banner banner--ok">
            <p>Nothing due right now — you&apos;re caught up.</p>
          </div>
        )}

        {!loading && queue.length > 0 && (
          <>
            <div className="banner banner--ok">
              <p>
                {(["makeup", "gate", "review", "learn"] as const)
                  .filter((k) => counts[k])
                  .map((k) => `${counts[k]} ${KIND_LABEL[k].toLowerCase()}`)
                  .join(" · ")}
              </p>
              <p className="sub">~{Math.round(totalMin * 10) / 10} min</p>
            </div>
            <button
              className="btn btn--primary"
              onClick={() => current && navigate(routeFor(current))}
            >
              Start — {KIND_LABEL[current!.kind]} 12:{current!.ayah}
            </button>
          </>
        )}

        <p>
          <Link className="btn btn--ghost" to="/drill?ayah=1">
            Free drill (pick an ayah) →
          </Link>
        </p>
        <p>
          <Link className="btn btn--ghost" to="/progress">
            Your Yūsuf — progress report →
          </Link>
        </p>
        <p>
          <Link className="btn btn--purple" to="/test">
            Take a Test →
          </Link>
        </p>
        <p>
          <Link className="btn btn--ghost" to="/system-explorer">
            System Explorer →
          </Link>
        </p>
        <p>
          <button className="btn btn--ghost" disabled={switching} onClick={() => void switchAccount()}>
            Not you? Switch account
          </button>
        </p>

        <Account />
      </div>
    </div>
  );
}
