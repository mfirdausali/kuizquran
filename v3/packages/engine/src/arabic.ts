// Arabic grading-equivalence normalization — v3-D12 / DEFECTS.md#B6 / edge
// case #44. Deliberately NARROW: NFC-normalize (canonical composition; the
// same JS/PHP-canonicalization concern the corpus compiler's hash spec
// names) and strip tatweel (U+0640, a purely typographic elongation glyph
// with no phonetic value). Harakat (vowel-marking diacritics) are KEPT
// DISTINCT on purpose — two words differing only in vowel-marking ARE
// different words, so folding them together would grade a wrong marking as
// correct (the exact failure mode edge case #45 calls "worse than B6").
//
// This is intentionally NOT the corpus-compiler's `normalizeArabic()` —
// that function folds alef variants, alef-maqsura, ta-marbuta and
// hamza-carriers together for DISTRACTOR-MATCHING/corpus-analysis purposes,
// a much broader equivalence than grading a learner's tap should ever use.

// Built via String.fromCodePoint rather than a literal character, so this
// file's own bytes carry no Arabic-range codepoint (v3/INVARIANTS.md
// Absolute B) — tatweel is a normalization-table entry, not sacred text,
// but this keeps the same strict bar the rest of this port holds to.
const TATWEEL = String.fromCodePoint(0x0640);

/** Normalize one Arabic surface form for grading comparison. */
export function normalizeArabicSurface(text: string): string {
  return text.normalize("NFC").split(TATWEEL).join("");
}

/**
 * The B6 fix (v3-D12): a tap grades correct when its normalized surface
 * equals the expected surface — always compared against whatever the CALLER
 * determined is correct AT THE CURRENT POSITION (this function itself has
 * no notion of "position"; it is the equality primitive rebuild.ts/
 * reconstruct.ts's position-scoped callers use).
 */
export function surfaceEquals(a: string, b: string): boolean {
  return normalizeArabicSurface(a) === normalizeArabicSurface(b);
}
