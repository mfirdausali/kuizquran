# Vendored inputs

Everything here is fetched once and committed — the compiler never hits the
network at compile time (build-plan step 3: "everything vendored (curl, never
urllib)"). Nothing in this directory is hand-authored Arabic; all Arabic text
originates from Quran.com / QAC and is copied byte-for-byte.

## `quran-morphology.txt`

Quranic Arabic Corpus (QAC) v0.4 morphology, full Quran. Copied from
`v1/data/raw/quran-morphology.txt` (v3 does not read from `v1/` at runtime —
CLAUDE.md: v3 is a new generation, not a migration — so this is a vendored
copy, not a live cross-tree read). 130,030 morphological-segment rows.

## `12-verses.json`, `12-mcq-items.json`, `12-mental-model.json`

Surah 12 (Yusuf)'s fused verse/word/translation data, hand-authored MCQ
distractor bank, and narrative mental model. Copied from the repo-root
`data/yusuf-*.json` files (the same inputs v1's compiler used) — 111 ayat,
1777 words.

## `103-verses.json`, `112-verses.json`

Surah 103 (Al-Asr, 3 ayat / 14 words) and surah 112 (Al-Ikhlas, 4 ayat / 15
words) — the two degenerate surahs build-plan step 3 names as fixture
sources. Fetched 2026-08-10 via:

```
curl "https://api.quran.com/api/v4/verses/by_chapter/<N>?language=en&words=true&word_fields=text_uthmani&fields=text_uthmani"
```

then reshaped into the same `{verse_number, text_uthmani, words[]}` schema as
`12-verses.json` (word-level `text_uthmani` + English word-by-word
`translation`, verse-level `text_uthmani` taken directly from the API's
per-verse field rather than reconstructed by joining words). Word counts were
cross-checked against `quran-morphology.txt`'s own per-surah word counts (14
and 15 respectively) before being committed.

Neither surah has an authored MCQ bank or mental model — none exists yet, and
none is invented here. The compiler handles that (`meta.distractorsAuthored`
/ `meta.hasMentalModel` are both `false` for these two), not this directory.

## `12-geometry.json`, `103-geometry.json`, `112-geometry.json`

Mushaf page number per verse and line number per word (build-plan step 4 —
BUILD-PLAN.md line 77: "geometry data landed at step 3–4"). Fetched
2026-08-10 via:

```
curl "https://api.quran.com/api/v4/verses/by_chapter/<N>?words=true&word_fields=line_number,char_type_name&fields=page_number&per_page=300"
```

then reshaped to `[{verse_number, page_number, words: [{position, line_number}]}]`,
dropping the API's trailing `char_type_name: "end"` word (the ayah-number
marker glyph, already excluded from the `-verses.json` files' word counts —
14/15/1777 unchanged). Each surah's word/verse counts were cross-checked
against the corresponding `-verses.json` file before being committed;
`buildCorpus.ts` hard-fails at compile time on any remaining per-ayah
mismatch rather than silently mis-mapping a line number onto the wrong word.

Numbers only — no Arabic text in these files.

## `12-ruku.json`, `67-ruku.json`, `103-ruku.json`, `112-ruku.json`

Per-surah **ruku count** — the input `packages/corpus-compiler/src/macro.ts`'s
`classify()` needs for its RING rule (v3-D21: "RING is `ruku >= 4`") and which
v3-D43 built the classifier around but never supplied, so every non-ATOMIC
surah silently fell to ARC (see v3-D43, and the closing decision that wires
this file in).

Fetched 2026-08-25 via:

```
curl "https://api.quran.com/api/v4/verses/by_chapter/<N>?fields=verse_key,ruku_number&per_page=300"
```

`ruku_number` in that response is the GLOBAL ruku index (Yusuf's first ayah is
ruku 193 of 556 in the whole Quran, not ruku 1 of Yusuf), so the vendored file
stores only the count of distinct values within the surah — the single fact
`classify()`'s `ring.segments` needs (it partitions the surah into that many
EVEN segments; it does not use real per-ruku boundaries — that is `evenSegments()`'s
existing, already-ratified behaviour, unchanged by this file). Counts: 12→12,
67→2, 103→1, 112→1 — cross-checked against the well-known Yusuf/Al-Mulk ruku
divisions before being committed. Numbers only — no Arabic text.
