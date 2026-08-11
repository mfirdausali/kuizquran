// EVERY WORD ON THE LANDING PAGE, IN ONE FILE.
//
// ---------------------------------------------------------------------------
// WHY THE COPY IS DATA AND NOT JSX
// ---------------------------------------------------------------------------
// v3-D19: "The app never claims to teach tajwid or replace a teacher. CI
// asserts no landing or onboarding string makes either claim."
//
// A CI clause over PROSE SCATTERED THROUGH JSX is a clause that scans template
// literals, attribute values and text nodes and gets it wrong in both
// directions — it fires on a comment explaining the rule, and it misses a
// sentence split across two JSX children. This build has already shipped six
// vacuous verifications; a claim-detector that cannot reliably find the claims
// would be the seventh.
//
// So the strings are DATA. `landingStrings()` returns every one of them as a
// flat array, `check-boundaries.mjs` clause 11 scans that array's source and
// `test/landing-claims.test.ts` scans the returned VALUES at runtime. Both
// directions are covered: a claim added to this file fails, and a claim added
// to JSX instead of this file fails clause 12 (which forbids raw prose in the
// landing page's markup).
//
// ---------------------------------------------------------------------------
// WHAT MAY NOT BE SAID HERE, AND WHY EACH ONE IS FALSE
// ---------------------------------------------------------------------------
//   "teaches tajwid" / "learn tajwid" / "correct pronunciation"
//        §21: "The app teaches words and their order, not pronunciation, madd
//        or ghunnah. A learner who only ever taps can produce a page correctly
//        and still recite it wrongly." There is no audio in this product and
//        no ear. The claim would be false on day one.
//
//   "replaces your teacher" / "no teacher needed" / "your teacher in your
//   pocket"
//        §21: "Tasmi' is how hifz has always been validated. The honest
//        position: the quiz is the daily driver; the teacher is the verifier."
//
//   "you have memorised it" as a result of the demo
//        §21's ladder: tapping from a bank is CUED production. Free recall is
//        explicitly NOT BUILT. §10's retention-honesty rule forbids calling
//        cued production "memorized".
//
// The positive form is stated instead, everywhere it is relevant: the quiz is
// the daily driver, the teacher is the verifier.
//
// ---------------------------------------------------------------------------
// NO TESTIMONIALS. NOT ONE. (§18 section 6)
// ---------------------------------------------------------------------------
// "Proof without users — cited science · builder's note · open build log. No
// fake testimonials, ever." There are no user quotes in this file because
// there are no users yet, and inventing one would poison exactly the trust
// this audience extends least readily. The proof section cites papers by name
// and states plainly what the product has not yet earned.
//
// ---------------------------------------------------------------------------
// PRICES ARE NOT WRITTEN HERE
// ---------------------------------------------------------------------------
// Edge case #196 / clause 10: prices live in `lib/pricing.ts` and become text
// only through `formatPrice`. The pricing section below carries the SHAPE of
// the offer (what is free, what recurs, what is one-off) and the price itself
// is interpolated at render from the constants. A price literal in this file
// would fail the build, correctly.

/** One section of the page, in §18's order. The section IDs double as the
 *  in-page anchor targets and as the keys the tests assert against. */
export type LandingSectionId =
  | "hero"
  | "demo"
  | "mechanism"
  | "plan"
  | "objections"
  | "proof"
  | "pricing"
  | "footer";

/** §18's table, in order. Exported so a test can assert the page renders all
 *  eight and in this sequence — the A/B note in §18 contemplates reordering
 *  hero/demo/mechanism later, and a reorder should be a deliberate edit here
 *  rather than a silent drift in the markup. */
export const SECTION_ORDER: readonly LandingSectionId[] = [
  "hero",
  "demo",
  "mechanism",
  "plan",
  "objections",
  "proof",
  "pricing",
  "footer",
];

export interface Point {
  heading: string;
  body: string;
}

export interface Objection {
  /** The objection in the visitor's own voice — a question they are already
   *  asking, never a strawman we can knock down easily. */
  question: string;
  answer: string;
}

export interface Citation {
  /** Author and year. Named so a reader can go and check it. */
  source: string;
  claim: string;
}

/** THE HERO. §18: loss-framed. The A/B note contemplates a mechanism-framed
 *  variant; when that lands it is a second constant here, not an edit to this
 *  one, so the two can be compared. */
export const HERO = {
  headline: "You memorized it. Do you still have it?",
  subhead:
    "Most people who finish a surah lose it within a year — not because they were careless, but because nothing was scheduled to bring it back.",
  /** v3-D07 rewrote this CTA: the old "free forever" promise is now false. */
  cta: "Start with one ayah — free, no account",
  /** The reassurance under the button. It states what does NOT happen, because
   *  that is what a visitor to a memorization app is bracing for. */
  ctaNote: "No sign-up. Nothing to install. The next thing you tap is the drill.",
} as const;

export const DEMO = {
  heading: "Do it now, before you decide anything",
  intro:
    "This is the whole mechanic. Every word of Al-Ikhlas, verse 1, is hidden. Tap them back in reading order. It takes about ten seconds and it is the same drill a paying learner does every morning.",
  /** Shown after the visitor completes it. Careful wording: what they DID,
   *  never what they now possess. */
  afterNote:
    "That was production from a blank line — the hardest rung this app schedules toward. What it is not: a check on your recitation. This app never listens.",
} as const;

/** §18 section 3: "Rebuild-don't-reread · the overnight gate · an honest
 *  number (half-life)." Three points, each backed by a real surface. */
export const MECHANISM: { heading: string; intro: string; points: readonly Point[] } = {
  heading: "Three things that make it stick",
  intro:
    "None of this is new science. It is well-replicated learning research, applied to the one thing it is almost never applied to.",
  points: [
    {
      heading: "Rebuild it, don't reread it",
      body: "Reading a verse again feels like progress and mostly is not. Pulling it back out of your own head is what strengthens it. Every drill here is a retrieval — you produce the words, you are never shown them and asked whether they look familiar.",
    },
    {
      heading: "The overnight gate",
      body: "A verse you nailed at midnight has proven nothing. The next morning it comes back cold — every word hidden, no warm-up — and until it survives that, you are not given anything new to learn. The app refuses to let you race ahead of what you can hold.",
    },
    {
      heading: "An honest number",
      body: "Each verse carries a measured half-life: how long before you would lose half of it without review. It is computed from your own misses, not from a streak counter, and it is allowed to go down. A number that only ever rises is a number that is lying to you.",
    },
  ],
} as const;

/** §18 section 4: the calendar. "We never shorten it to flatter you." */
export const PLAN = {
  heading: "You will know what tomorrow costs",
  body: "The plan is a real calendar, built from your measured pace. Near days list exactly what is due. Far days show only the shape — about eight minutes a day, finishing around a date — because a review three weeks out genuinely depends on how the next twenty sessions go, and filling that in with specific verses would look better and be false.",
  /** The promise §18 quotes verbatim. */
  promise: "We never shorten it to flatter you.",
  /** Honest about what the visitor is looking at. Not a screenshot of a
   *  fictional learner's calendar — that is the same lie as a testimonial. */
  caveat:
    "Days off are marked away, not missed. Travel and illness adjust the forecast; they do not score against you.",
} as const;

/** §18 section 5. The three objections a real visitor actually has. */
export const OBJECTIONS: { heading: string; items: readonly Objection[] } = {
  heading: "The three things you are probably thinking",
  items: [
    {
      question: "My tajwid is weak. Will this expose me?",
      answer:
        "No, because this app cannot hear you. It drills the words and their order — which verse, which word, in what sequence. Pronunciation, madd and ghunnah are not what it measures and not what it can measure. The quiz is your daily driver; a teacher is the one who verifies how you sound. It does not do that job and does not pretend to.",
    },
    {
      question: "Is this another streak app?",
      answer:
        "There is a streak, and it is deliberately unimportant. No leaderboard, no ranking, no score to compare with anyone. Nobody can see which verses are weak for you — not friends, not us in any list we would publish. And there are no guilt notifications, because a person who missed three days needs a way back in, not a reminder that they failed.",
    },
    {
      question: "Which surahs can I actually use it on?",
      answer:
        "A small, deliberately short list at launch — the surahs whose text, structure and word-by-word data have been prepared and checked, not everything at once. You will always see exactly what is available before you commit to anything.",
    },
  ],
} as const;

/** §18 section 6: proof without users. Cited science, a builder's note, and the
 *  open build log. NO TESTIMONIALS — see this file's header. */
export const PROOF: {
  heading: string;
  intro: string;
  citations: readonly Citation[];
  buildersNote: string;
  buildLog: string;
  noTestimonials: string;
} = {
  heading: "Why believe any of this",
  intro:
    "This product has no users yet, so it has nothing true to quote from one. What it has instead is a mechanism built on published findings, and a build log anyone can read.",
  citations: [
    {
      source: "Roediger & Karpicke, 2006 — the testing effect",
      claim:
        "Students who were tested on a passage retained substantially more of it a week later than students who reread it for the same amount of time — even though the rereaders felt more confident.",
    },
    {
      source: "Cepeda et al., 2006 — distributed practice, a meta-analysis",
      claim:
        "Spacing the same total study time across days beats massing it, and the best gap grows with how long you need to remember the material.",
    },
    {
      source: "Bjork & Bjork, 2011 — desirable difficulties",
      claim:
        "Conditions that make practice feel harder and slower often produce better long-term retention. The feeling of fluency during study is a poor guide to what you will still have next month.",
    },
  ],
  buildersNote:
    "I built this because I finished a surah twice and lost it twice, and no app I tried was designed around keeping it — they were all designed around finishing it. Everything here follows from that one difference.",
  buildLog:
    "Every decision, defect and reversal in this build is written down as it happens, including the ones that were wrong. It is not a changelog written afterwards to look tidy.",
  noTestimonials:
    "You will not find a testimonial on this page. When there are learners with real results, their words will appear here with their permission and not before.",
} as const;

/** §18 section 7. THE SHAPE of the offer only — the numbers come from
 *  `lib/pricing.ts` at render (edge case #196 / clause 10). */
export const PRICING_COPY = {
  heading: "What it costs",
  /** v3-D07's own framing, minus the numerals. */
  trial: "Try one surah free, or fourteen days — whichever you reach first. No card to start.",
  monthlyLabel: "Monthly",
  lifetimeLabel: "Lifetime",
  lifetimeNote:
    "Lifetime only makes sense if you stay for years. That is the point of the product, so the maths is stated plainly rather than hidden: it pays for itself after about two years, and not before.",
  /** The one ethical obligation, from v3-D07. This sentence is a promise the
   *  product code must keep, not marketing. */
  neverHostage:
    "Your memory is never held hostage. Reviews stay open for seven days past the trial, your progress is never deleted, and unpaid data waits for you rather than expiring. You are charged for access, never for the remembering.",
  regionNote:
    "Prices are set by region, and you can change your region yourself. Travelling never reprices you.",
} as const;

/** §18 section 8. The four "no"s, verbatim, plus v3-D07's honest addition. */
export const FOOTER = {
  ethics: "No ads. No selling data. No dark patterns. No guilt notifications.",
  /** v3-D07: "The footer gains an honest line." */
  customer: "You pay us, so you are the customer — not the product.",
  /** The positioning line, stated in the footer so it is on the page even for
   *  a visitor who skipped the objections. */
  position: "The quiz is the daily driver. The teacher is the verifier.",
} as const;

/**
 * EVERY landing string, flat. The CI claim-check consumes this.
 *
 * It is built by walking the exported constants rather than by re-listing the
 * strings, because a hand-maintained second list is a list that will be missing
 * the one string somebody added last week — which is precisely the sentence a
 * claim-checker exists to catch.
 */
export function landingStrings(): string[] {
  const out: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === "string") {
      out.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value) walk(v);
      return;
    }
    if (value && typeof value === "object") {
      for (const v of Object.values(value)) walk(v);
    }
  };
  walk([HERO, DEMO, MECHANISM, PLAN, OBJECTIONS, PROOF, PRICING_COPY, FOOTER]);
  return out;
}
