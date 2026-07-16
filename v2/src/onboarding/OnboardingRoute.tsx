// The /onboarding route: loads the corpus (same pattern as Home/Drill/Gate),
// then hands off to the Onboarding flow.
import { useEffect, useState } from "react";
import type { Corpus } from "engine";
import { loadCorpus } from "../corpus/loadCorpus.ts";
import { Onboarding } from "./Onboarding.tsx";

const SURAH = 12; // v2 ships Yusuf only (v2-D29); the loader itself takes surah as a param.

export function OnboardingRoute() {
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCorpus(SURAH)
      .then(setCorpus)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="screen">
        <div className="banner banner--warn">
          <p>Corpus failed to load: {error}</p>
        </div>
      </div>
    );
  }

  if (!corpus) {
    return (
      <div className="screen">
        <p className="voice">Loading…</p>
      </div>
    );
  }

  return <Onboarding corpus={corpus} />;
}
