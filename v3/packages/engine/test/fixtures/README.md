# Engine test fixture

`12.json` is v2's own compiled Yusuf corpus (`v2/public/corpus/12.json`),
copied byte-for-byte — build-plan step 5 (engine verbatim port). Per
NIGHTLY.md's fixture-circularity note: "the engine port starts against a
Yusuf fixture cut from v2's corpus at the pinned SHA (no new Arabic enters
the world)".

Its shape matches `src/types.ts`'s `Corpus`/`CorpusVerse`/`CorpusWord`
exactly (no per-row `surah` field, verse-level `page`+`line`) — this is
the shape those types have BEFORE build-plan step 7's E-01 engine-half fix,
which is the honest, deliberate state for a verbatim port (bugs and gaps
included; step 7 is where the surah field lands). Do not swap this for
v3/packages/corpus-compiler's output — that package's output already has
the E-01 fix (`surah` on every row, no verse-level `line`) and does not
match this package's pre-fix `Corpus` type until step 7 lands here too.

Not hand-authored: this is a vendored copy of an already-compiled artifact
whose Arabic originates from Quran.com/QAC, the same chain of custody as
every other vendored fixture in this repo.
