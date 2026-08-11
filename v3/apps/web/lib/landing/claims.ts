// THE v3-D19 CLAIM DETECTOR.
//
//     "The app never claims to teach tajwid or replace a teacher. CI asserts no
//      landing or onboarding string makes either claim."
//                                                              — v3-D19
//
// BUILD-PLAN names this a CI clause. It is implemented here as a pure function
// so that ONE definition of "makes the claim" is shared by:
//
//   - `test/landing-claims.test.ts`, which runs it over the actual VALUES of
//     `landingStrings()` — the strings the page will really paint; and
//   - `scripts/check-boundaries.mjs` clause 11, which runs the same patterns
//     over the SOURCE of the copy modules, so a claim fails `npm run build` as
//     well as `npm test`.
//
// Two checks, one definition. A detector that existed only in a test would go
// green the day someone wrote the claim in a component instead of the copy
// module; a detector that existed only in the gate would never see a string
// assembled at runtime.
//
// ---------------------------------------------------------------------------
// WHY THIS IS PATTERN-BASED AND WHAT THAT HONESTLY CANNOT DO
// ---------------------------------------------------------------------------
// Stated plainly, because the alternative is a check that is trusted more than
// it deserves: this cannot understand English. It catches the phrasings a
// marketing edit actually reaches for — and those are a small, enumerable set,
// because the claims in question are sales claims and sales claims are
// formulaic ("learn tajwid", "perfect your pronunciation", "no teacher
// needed", "your sheikh in your pocket").
//
// It will not catch an elaborate paraphrase. What it does catch is the drift
// that actually happens: someone under conversion pressure writes the obvious
// sentence. The rule's real enforcement is that the copy lives in ONE reviewed
// file; this detector makes the obvious violations impossible to merge.
//
// NEGATION IS THE HARD PART, and it is handled explicitly. The honest copy
// MUST be able to say "this app does not teach tajwid" and "a teacher is the
// one who verifies" — those sentences contain the very words the naive pattern
// bans. A detector that fired on them would force the page to stop making the
// honest disclaimer, which is the exact opposite of what v3-D19 wants. So a
// match is DISCHARGED when the sentence containing it is negated or is the
// verifier-positioning statement.
//
// The sentence is the unit, not the paragraph: "This app cannot hear you. It
// teaches tajwid." must fail, and it does, because the negation in the first
// sentence does not reach the second.

export interface ClaimHit {
  /** The full sentence that carries the claim, so a failure names it. */
  sentence: string;
  /** Which prohibition it broke. */
  kind: "tajwid" | "replaces-teacher" | "memorized";
  /** The literal fragment that matched, for a legible error message. */
  matched: string;
}

/**
 * Claims to TEACH tajwid / pronunciation.
 *
 * §21: "The app teaches words and their order, not pronunciation, madd or
 * ghunnah." There is no audio and no ear in this product.
 */
const TAJWID_CLAIMS: readonly RegExp[] = [
  /\b(?:teach|teaches|teaching|learn|master|masters|mastering|improve|improves|perfect|perfects|fix|fixes)\s+(?:your\s+|the\s+)?tajwid\b/i,
  /\btajwid\s+(?:lessons?|course|training|instruction)\b/i,
  /\b(?:teach|teaches|teaching|learn|master|correct|corrects|perfect|perfects|improve|improves)\s+(?:your\s+|the\s+)?(?:pronunciation|recitation|makhraj|makhaarij|madd|ghunnah)\b/i,
  /\bpronunciation\s+(?:lessons?|coaching|feedback|correction)\b/i,
  /\b(?:checks?|grades?|scores?|corrects?|listens? to)\s+(?:your\s+)?(?:recitation|pronunciation|tajwid)\b/i,
  /\brecite\s+(?:it\s+)?(?:correctly|perfectly)\s+(?:with|using)\s+(?:this|the)\s+app\b/i,
];

/**
 * Claims to REPLACE a teacher.
 *
 * §21: "Tasmi' is how hifz has always been validated. The honest position: the
 * quiz is the daily driver; the teacher is the verifier."
 */
const TEACHER_CLAIMS: readonly RegExp[] = [
  /\b(?:replaces?|replacing|instead of|in place of)\s+(?:your\s+|a\s+|the\s+)?(?:teacher|ustaz|ustadh|sheikh|shaykh|tutor|halaqah|halaqa)\b/i,
  /\bno\s+(?:teacher|ustaz|ustadh|sheikh|shaykh|tutor)\s+(?:needed|required|necessary)\b/i,
  /\b(?:you\s+)?(?:don'?t|do not)\s+need\s+(?:a\s+|your\s+)?(?:teacher|ustaz|ustadh|sheikh|shaykh|tutor)\b/i,
  /\b(?:your\s+)?(?:teacher|ustaz|ustadh|sheikh|shaykh)\s+in\s+your\s+pocket\b/i,
  /\b(?:a|the)\s+(?:teacher|ustaz|ustadh|sheikh|shaykh|tutor)\s+(?:in|on)\s+your\s+(?:phone|pocket)\b/i,
  /\bwithout\s+(?:ever\s+)?(?:needing\s+)?(?:a\s+|your\s+)?(?:teacher|ustaz|ustadh|sheikh|shaykh|tutor)\b/i,
  /\b(?:as good as|better than)\s+(?:a\s+|your\s+)?(?:teacher|ustaz|ustadh|sheikh|shaykh|tutor)\b/i,
];

/**
 * Claims the LEARNER HAS MEMORIZED something AS A RESULT OF THE APP.
 *
 * §21's ladder: the app reaches CUED production. Free recall is not built.
 * §10's retention-honesty rule forbids calling cued production "memorized",
 * and the demo is precisely where that overclaim is tempting ("you've
 * memorized your first ayah!").
 *
 * ---------------------------------------------------------------------------
 * THE TENSE IS THE WHOLE DISTINCTION, AND IT WAS GOT WRONG FIRST TIME
 * ---------------------------------------------------------------------------
 * The first version of this group was `\byou(?:'ve| have)\s+(?:now\s+)?
 * memori[sz]ed\b`, and on its very first run against the real tree it fired on
 * onboarding's placement summary: *"Starting point: you have memorised this
 * before"*.
 *
 * That is not the prohibited claim. It is the LEARNER'S OWN REPORT of prior
 * memorization, in the past tense, echoed back on a confirmation screen — the
 * app making no assertion at all about what it achieved. §17's placement screen
 * exists precisely to ask that question, so a detector that banned the answer
 * would make the honest screen unwritable.
 *
 * What IS prohibited is the app crediting ITSELF: "you've memorized your first
 * ayah", "it's memorized now", "you now know it by heart". So the patterns
 * require a NOW-ness marker (`now`, `just`, `already`, an exclamation of
 * completion) or an explicit future/guarantee, and past-tense self-report with
 * `before` / `previously` / `used to` is discharged.
 *
 * Recorded because it is the difference between a check that guards the rule
 * and a check that merely makes noise near it — and a noisy check is one people
 * route around, which is how v3-D53 happened.
 *
 * THE SECOND FALSE POSITIVE, on the same run: the tightened pattern
 * `\byou\s+memori[sz]ed\s+(?:your\s+first|it)\b` fired on §18's OWN APPROVED
 * HERO — *"You memorized it. Do you still have it?"*
 *
 * That headline is the entire loss-framing of the page, and it is about
 * memorization the visitor did YEARS AGO, ELSEWHERE, before this app existed.
 * The very next sentence asks whether they still have it. Reading that as the
 * app claiming credit inverts its meaning completely.
 *
 * Two false positives, both from the same mistake: matching the WORD
 * "memorized" near the word "you" rather than matching the CLAIM. The claim is
 * always marked — by `now`, `just`, `already`, or "your first" — because the
 * app crediting itself has to say WHEN, and the when is always this moment.
 * Unmarked past tense is a visitor's own history and is none of the rule's
 * business. `you memorized it` therefore stays legal; `you just memorized it`
 * does not.
 *
 * Both are kept in this comment rather than fixed silently, because "the check
 * fired and I loosened it" is the exact motion that produces a vacuous gate,
 * and the only defence is stating what was loosened and why it was right.
 */
const MEMORIZED_CLAIMS: readonly RegExp[] = [
  /\byou(?:'ve| have)\s+(?:now|just|already)\s+memori[sz]ed\b/i,
  /\byou\s+(?:now|just)\s+memori[sz]ed\b/i,
  /\byou\s+memori[sz]ed\s+your\s+first\b/i,
  /\byou\s+now\s+know\s+it\s+by\s+heart\b/i,
  /\bit(?:'s| is)\s+(?:now|already)\s+memori[sz]ed\b/i,
  /\b(?:that'?s|this is)\s+(?:it\s+)?memori[sz]ed\b/i,
  /\bguarantee(?:d|s)?\s+(?:you(?:'ll| will)\s+)?(?:never\s+forget|remember\s+(?:it\s+)?forever)\b/i,
  /\bnever\s+forget\s+(?:it|a\s+(?:verse|surah|thing))\s+again\b/i,
  /\byou(?:'ll| will)\s+never\s+lose\s+(?:it|a\s+(?:verse|surah))\b/i,
];

/** Negations and positionings that DISCHARGE a match inside the same sentence.
 *
 *  Each of these exists because the honest copy needs it:
 *    - "this app does not teach tajwid"          → not/never/cannot
 *    - "the teacher is the verifier"             → verifier positioning
 *    - "it is not a claim about your recitation" → not a claim
 *  Kept deliberately tight. A broad "contains the word not" would let
 *  "not just tajwid — we perfect your pronunciation too" through.
 *
 *  CRITICAL — A DISCHARGER MAY NOT OVERLAP THE MATCH ITSELF. Several of the
 *  prohibited claims are NEGATIVE IN FORM: "no teacher needed", "you don't need
 *  a teacher", "you'll never forget it". The first version of this list
 *  discharged those, because the sentence obviously contains a negation — so
 *  the four most-marketable overclaims in the whole prohibition were silently
 *  unenforceable. The MUST_FAIL tests caught it; nothing else would have,
 *  because the copy is clean and the "our copy is clean" assertion would have
 *  stayed green forever over a detector that could not see them.
 *
 *  So `isDischarged` requires a discharging negation to sit OUTSIDE the span
 *  the claim matched. "This app does not teach tajwid" discharges (the `does
 *  not` is outside `teach tajwid`); "no teacher needed" does not (the `no` IS
 *  the match). */
const DISCHARGERS: readonly RegExp[] = [
  /\b(?:does not|doesn'?t|do not|don'?t|cannot|can'?t|will not|won'?t|never|no)\b/i,
  /\bis\s+not\b/i,
  /\bteacher\s+is\s+the\s+verifier\b/i,
  /\bverifies\b/i,
  /\bnot\s+what\s+it\s+(?:measures|does)\b/i,
  /\bmemori[sz]ed\s+(?:this|it|them)?\s*(?:before|previously|in the past)\b/i,
  /\bused\s+to\s+(?:know|have)\b/i,
];

/** Split into sentences. The unit of a claim is a sentence: a disclaimer in
 *  one sentence must not launder a claim in the next. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const GROUPS: ReadonlyArray<{ kind: ClaimHit["kind"]; patterns: readonly RegExp[] }> = [
  { kind: "tajwid", patterns: TAJWID_CLAIMS },
  { kind: "replaces-teacher", patterns: TEACHER_CLAIMS },
  { kind: "memorized", patterns: MEMORIZED_CLAIMS },
];

/**
 * Is this match discharged by a negation ELSEWHERE in the sentence?
 *
 * "Elsewhere" is the whole point — see DISCHARGERS' header. A negation that
 * overlaps the matched span is PART OF the claim ("no teacher needed"), not a
 * denial of it, and must not excuse it.
 */
export function isDischarged(sentence: string, matchStart: number, matchEnd: number): boolean {
  for (const discharger of DISCHARGERS) {
    // Global copy so `exec` walks every occurrence: a sentence may hold both an
    // overlapping negation and a genuine one, and only the genuine one counts.
    const g = new RegExp(discharger.source, discharger.flags.includes("g") ? discharger.flags : `${discharger.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = g.exec(sentence)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      const overlaps = start < matchEnd && end > matchStart;
      if (!overlaps) return true;
      if (m[0].length === 0) break; // guard against a zero-width infinite loop
    }
  }
  return false;
}

/**
 * Every prohibited claim in one string. Empty array when the string is clean.
 *
 * Returns ALL hits rather than the first, so a failing test names every
 * sentence that has to change instead of forcing one round trip per claim.
 */
export function findClaims(text: string): ClaimHit[] {
  const hits: ClaimHit[] = [];
  for (const sentence of sentences(text)) {
    for (const group of GROUPS) {
      for (const pattern of group.patterns) {
        const m = sentence.match(pattern);
        if (!m || m.index === undefined) continue;
        if (isDischarged(sentence, m.index, m.index + m[0].length)) continue;
        hits.push({ sentence, kind: group.kind, matched: m[0] });
      }
    }
  }
  return hits;
}

/** Convenience over many strings, tagging each hit with where it came from. */
export function findClaimsIn(
  strings: readonly string[],
): Array<ClaimHit & { index: number }> {
  const out: Array<ClaimHit & { index: number }> = [];
  strings.forEach((s, index) => {
    for (const hit of findClaims(s)) out.push({ ...hit, index });
  });
  return out;
}
