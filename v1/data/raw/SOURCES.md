# Vendored source data

## quran-morphology.txt — Quranic Arabic Corpus (QAC) morphology

- **Source:** The Quranic Arabic Corpus, v0.4 (Kais Dukes, University of Leeds),
  <https://corpus.quran.com/> — Arabic-script conversion mirror
  <https://github.com/mustafa0x/quran-morphology> (`quran-morphology.txt`).
- **Format:** TSV, one row per morphological **segment**. Columns:
  `LOCATION\tFORM\tTAG\tFEATURES` where
  `LOCATION = surah:ayah:word:segment`, `TAG` is a coarse POS letter
  (`N` noun, `V` verb, `P` particle), and `FEATURES` is a `|`-delimited list
  carrying `ROOT:` and `LEM:` in Arabic script plus grammatical features.
- **Why vendored:** the compiler joins per-word lemma/root/class onto the
  Yusuf dataset and builds a full-Quran word set for distractor validation.
  Committed so the build is offline and reproducible.
- **License:** GNU General Public License. The Quran text itself may be copied
  and distributed verbatim; the QAC annotations are GPL. Attribution required —
  cite the Quranic Arabic Corpus.

## Full-Quran Uthmani text

Not vendored separately: the full-Quran word set used for the "distractor exists
in the Quran" validation is derived from `quran-morphology.txt` (it contains
every word of all 114 surahs). Underlying Uthmani text originates from the
**Tanzil Project** (<https://tanzil.net>), the QAC's text basis.

## Fused Yusuf inputs (not in this folder)

The compiler's primary inputs live in `../../data/` (the `kuizquran/data/`
directory): `yusuf-verses.json`, `yusuf-mcq-items.json`,
`yusuf-mental-model.json`. These were authored earlier in the project and are
not re-vendored here.
