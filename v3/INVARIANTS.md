# The invariants

Six locked rules plus two absolutes. **This file is injected at the top of every
agent brief.** If a change breaks one of these, the change is wrong — not the
invariant.

Each has a mechanical check. An invariant without a check is a wish (see
"Property pack" below).

---

## 1 — The graded atom is the AYAH (and the CONNECTION)

Atoms are per-ayah and per-connection `n→n+1`. **Never per-word, never
per-question.** Word taps are *evidence* that rolls up to the ayah atom.

Yusuf = 111 ayah atoms + 110 connection atoms = 221. That bound is what keeps
scheduling tractable at multi-surah scale.

*Check:* a detector test fails if any atom key resolves to a word position.

## 2 — The append-only EVENT LOG is truth

`atoms` is a **rebuildable cache**, folded from events by `rebuild()`. Any state
must be reconstructible from the log alone.

Every tap commits to storage **before** the UI reacts — `append()` resolves only
after the transaction durably completes.

*Check:* `fold_determinism_check` re-folds sampled logs nightly and byte-compares
against the cache. Any divergence is a P1.

## 3 — First-pass meaning errors are PRETEST

Excluded from strength entirely. You cannot fail at something nobody taught you
yet.

*Check:* the golden log contains a pretest event; a property test asserts it
moves no strength.

## 4 — Evidence asymmetry

- Errors carry **full** weight.
- Massed same-day successes are damped **×0.35**.
- Spacing is measured **between retrievals**, never between app-opens.
- Post-lapse stability is damped **×0.4**, never zeroed.

*Check:* the golden log contains a massed/spaced pair and a day-boundary pair.

## 5 — Only STRUCTURED sessions mutate lifecycle

Free-play is evidence only. `test_*` events are a read-only mirror — `rebuild.ts`
has **no branch** for them, by structural absence rather than by a guard.

*Check:* a property test asserts free-play and test events move no strength.

## 6 — Selection and sequencing live in the PURE engine

React renders what it is given and **never decides**. No component may branch on
`rung`, schedule state, or selection.

*Check:* `ui-builder` output is grep-clean for those conditionals. This is the
invariant B2 currently violates.

---

## Absolute A — the engine is PURE

No DOM. No IO. No `Date.now()`, no `Math.random()`, no `crypto`. No zero-arg
`new Date()` **and no local-date getters** (`getFullYear`, `getMonth`,
`getDate`, `getDay`) — that last one is the real leak: `v2/daybound.ts:23,49`
uses machine-local dates, so the same event folds differently in UTC than in
Kuala Lumpur. `now` and the IANA timezone are always passed in.

*Check:* purity lint over `packages/engine/**`.

## Absolute B — the Quran text is SACRED

A model must **never** generate or alter Quranic Arabic. It comes from the
compiled corpus, which comes from Quran.com.

`CorpusRef` is a five-variant union of **coordinates** — `word`, `verse`,
`gloss`, `distractor`, `ayahNumber`. There is **no `{ literal: string }`
member**. Every answer and option resolves through `resolveRef()`, which can
only return bytes already present in the corpus. An Arabic `Face` carries a
mandatory `from: CorpusRef`, so provenance is *produced*, not claimed.

*Check:* an Arabic-codepoint grep over every diff, covering U+0600–06FF,
U+0750+, presentation forms U+FB50–FDFF and U+FE70–FEFF, `\u` escapes,
`fromCharCode`, across `.ts`/`.tsx`/`.php`/`.json`/`.sql`. **Tests reference
fixture coordinates, never inline Arabic.**

---

## The property pack

Invariants 1, 3, 4 and 5 erode silently — nothing crashes when they break. They
each get a property test, and the golden log deliberately contains a triggering
input for every one:

| Invariant | Trigger in the golden log |
|---|---|
| 1 | a word-tap that must roll up, not create an atom |
| 3 | a first-pass meaning error |
| 4 | a massed/spaced pair, and a 23:50 / 00:10 day-boundary pair |
| 5 | a free-play event and a `test_*` event |

Without those triggers the tests pass vacuously.
