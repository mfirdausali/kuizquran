// Onboarding flow (ROADMAP Phase 3): placement → anchor hour → pace mode →
// gloss language → Home. Each step persists locally as it's chosen
// (session/anchor.ts, session/pace.ts, session/glossLang.ts); the placement
// result is cached LAST (session/placement.ts) so a learner who closes mid-flow
// re-enters onboarding from the top next time, rather than landing "ready" with
// missing settings (useOnboarding.ts gates on the placement cache).
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Corpus, PaceMode, PlacementResult } from "engine";
import { DEFAULT_PACE_MODE } from "engine";
import { Placement } from "./Placement.tsx";
import { ANCHOR_CHOICES, setAnchorHour } from "../session/anchor.ts";
import { setPaceMode } from "../session/pace.ts";
import { setGlossLang } from "../session/glossLang.ts";
import { savePlacement } from "../session/placement.ts";

type Step = "placement" | "anchor" | "pace" | "lang";

const PACE_MODES: { mode: PaceMode; label: string; blurb: string }[] = [
  { mode: "steady", label: "Steady", blurb: "1 new ayah/day, reserved slot" },
  { mode: "sprint", label: "Sprint", blurb: "More new ayat, wider gate window" },
  { mode: "maintain", label: "Maintain", blurb: "Reviews + chains only, no new" },
];

export function Onboarding({ corpus }: { corpus: Corpus }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("placement");
  const [placement, setPlacement] = useState<PlacementResult | null>(null);

  // Cache the placement result LAST, after every step is chosen — see the
  // file-header note on why this must not happen earlier.
  const finish = () => {
    if (placement) {
      savePlacement({
        carriedAyat: placement.carriedAyat,
        startAyah: placement.startAyah,
        ayahPerDay: placement.dailyPlan.ayahPerDay,
      });
    }
    navigate("/");
  };

  if (step === "placement") {
    return (
      <Placement
        corpus={corpus}
        onDone={(r) => {
          setPlacement(r);
          setStep("anchor");
        }}
      />
    );
  }

  if (step === "anchor") {
    return (
      <div className="screen">
        <div className="card">
          <div className="card-header">
            <span>iman · Yusuf</span>
            <span>your anchor</span>
          </div>
          <p className="voice">When do you want your daily moment with the Qur&apos;an?</p>
          <p className="caption">
            Pick a time you&apos;ll remember. We&apos;ll anchor your day around it — you can
            change it later.
          </p>
          {ANCHOR_CHOICES.map((c) => (
            <button
              key={c.hour}
              className="btn"
              onClick={() => {
                setAnchorHour(c.hour);
                setStep("pace");
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "pace") {
    return (
      <div className="screen">
        <div className="card">
          <div className="card-header">
            <span>iman · Yusuf</span>
            <span>your pace</span>
          </div>
          <p className="voice">How much time can you give this most days?</p>
          {PACE_MODES.map((p) => (
            <button
              key={p.mode}
              className="btn"
              onClick={() => {
                setPaceMode(p.mode);
                setStep("lang");
              }}
            >
              {p.label} — {p.blurb}
            </button>
          ))}
          <button
            className="btn btn--ghost"
            onClick={() => {
              setPaceMode(DEFAULT_PACE_MODE);
              setStep("lang");
            }}
          >
            Not sure — use the default
          </button>
        </div>
      </div>
    );
  }

  // step === "lang"
  return (
    <div className="screen">
      <div className="card">
        <div className="card-header">
          <span>iman · Yusuf</span>
          <span>meaning language</span>
        </div>
        <p className="voice">Which language should we show word meanings in?</p>
        <p className="caption">You can ask for either — pick whichever you understand best.</p>
        <button
          className="btn btn--primary"
          onClick={() => {
            setGlossLang("en");
            finish();
          }}
        >
          English
        </button>
        <button
          className="btn"
          onClick={() => {
            setGlossLang("ms");
            finish();
          }}
        >
          Bahasa Melayu
        </button>
      </div>
    </div>
  );
}
