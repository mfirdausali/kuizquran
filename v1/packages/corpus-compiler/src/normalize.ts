// Arabic text normalization, shared by the distractor-corpus check and the
// look-alike similarity. Uthmani spelling in the fused inputs and the QAC forms
// carry different diacritics/tatweel/alef variants for the same word, so we fold
// them to a comparable skeleton.

// Combining marks to strip: harakat, tanwin, shadda, sukun (064B–0652),
// maddah/hamza-above/below and Quranic annotation signs (0653–065F, 0670,
// 06D6–06ED), plus tatweel (0640) and the Quranic small high signs range.
const DIACRITICS =
  /[ً-ٰٟۖ-ۜ۟-۪ۨ-ۭـ]/g;

/**
 * Fold a word to a comparison skeleton:
 *  - strip all diacritics, tatweel, superscript/Quranic marks
 *  - unify alef variants (wasla 0671, madda 0622, hamza-above 0623,
 *    hamza-below 0625, dagger contexts) to bare alef 0627
 *  - unify alef-maqsura (0649) to ya (064A) and ta-marbuta (0629) to ha (0647)
 *  - unify all hamza carriers (0624 waw-hamza, 0626 ya-hamza, 0621 bare) to 0621
 *  - drop leftover spaces
 */
export function normalizeArabic(input: string): string {
  let s = input.normalize("NFC");
  s = s.replace(DIACRITICS, "");
  s = s
    .replace(/[ٱآأإٰ]/g, "ا") // alef variants → alef
    .replace(/ى/g, "ي") // alef maqsura → ya
    .replace(/ة/g, "ه") // ta marbuta → ha
    .replace(/[ؤئ]/g, "ء"); // waw/ya-hamza → hamza
  s = s.replace(/\s+/g, "");
  return s;
}

/**
 * Fold a single trailing alef that follows a consonant — the alef of accusative
 * nunation (tanwin), e.g. كوثرا → كوثر — so an indefinite-accusative distractor
 * matches its base form in the corpus. Operates on an already-normalized string.
 * Only strips when the result stays ≥2 chars.
 */
export function foldTanwin(norm: string): string {
  const m = /^(.*[بتثجحخدذرزسشصضطظعغفقكلمنهوي])ا$/.exec(norm);
  if (m && m[1]!.length >= 2) return m[1]!;
  return norm;
}

/** Normalized character-bigram Dice coefficient in [0,1] for look-alike scoring. */
export function scriptSimilarity(a: string, b: string): number {
  const na = normalizeArabic(a);
  const nb = normalizeArabic(b);
  if (na.length === 0 || nb.length === 0) return 0;
  if (na === nb) return 1;
  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    if (s.length === 1) {
      m.set(s, 1);
      return m;
    }
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const ma = bigrams(na);
  const mb = bigrams(nb);
  let overlap = 0;
  for (const [g, ca] of ma) {
    const cb = mb.get(g);
    if (cb) overlap += Math.min(ca, cb);
  }
  const total =
    [...ma.values()].reduce((x, y) => x + y, 0) +
    [...mb.values()].reduce((x, y) => x + y, 0);
  return (2 * overlap) / total;
}
