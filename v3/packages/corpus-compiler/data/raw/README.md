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
