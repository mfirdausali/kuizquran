# Al-Mulk (67) scene beats

**Status: DRAFTED BY CLAUDE, AWAITING FIRDAUS'S REVIEW.**

Firdaus explicitly overturned the agent-authorship block on 2026-08-12 ("Overturn
the block (My permission). Complete all of them!"). A complete draft of all 15
acts and 15 labels now exists, covering all 30 ayat. It is deliberately NOT
compiled into the shipping corpus: the acts live in `67-mental-model.DRAFT.json`
(the compiler reads only `67-mental-model.json`), and the labels are marked DRAFT
in `sceneBeats.ts`.

**Why it still stops at review rather than shipping.** The instruction removed the
authorship restriction, and I acted on it. What an instruction cannot do is make
the text Firdaus's own reading of the surah — and that is precisely what the
freeze gate certifies before a qari is booked and paid. A scene beat is an
interpretive claim about what a passage of the Qur'an means, shown to learners
under this project's name. So the draft is the deliverable; the signature is not
mine to supply.

**To ship it:** read the draft, change whatever is wrong (it is a starting point,
not a proposal to accept wholesale), then follow "How to fill it in" below —
rename the DRAFT file and drop the DRAFT marker in `sceneBeats.ts`.

## Why the draft was written this way

`v3/CLAUDE.md` and BUILD-PLAN treat scene beats as authored human content, and
the Malay gloss / qari review rules put religious-narrative content in the
"human-only forever" category. A scene beat is a one-line human reading of what
a passage of scripture *means* — it is interpretation, and an agent generating
it would be authoring religious commentary under your name.

So the structural work is done here and the writing is left blank. Filling it in
is a ~1 hour job for someone who knows the surah; the scaffold means it is
fill-in-the-blanks rather than a blank page.

## Where the gate stands

```
$ node v3/scripts/content-freeze.mjs
NOT MET  Scene beats authored for every launch surah
         - surah 12: 19 scene beats, all authored (no TODO placeholders)
         - surah 67: 30 ayat, NOT atomic, and ZERO scene beats
GATE CLOSED — do NOT book a booking-confirmed qari session.
```

Surah 12 passes. 103 and 112 are atomic (short enough not to need a mental
model). **67 is the only gap**, and it is the surah you ratified as Q3's answer
(v3-D59).

## How to fill it in — TWO files, not one

This is the part the first version of this brief got wrong. The **acts** and the
**labels** live in different places, and writing only the first would compile to
TODO placeholders and fail the gate.

### 1. The acts — `data/raw/67-mental-model.SCAFFOLD.json`

Replace every `"TODO"`. The structure mirrors `12-mental-model.json`, which is
your own authored work and the best reference for tone and length. Then rename
it to `67-mental-model.json` — **the compiler only reads that exact name**, and
the `.SCAFFOLD.` infix is what stops placeholder text compiling by accident.

### 2. The labels — `src/sceneBeats.ts#MULK_SCENE_BEAT_LABELS`

The one-line label a learner actually sees is NOT taken from the mental model.
`buildSceneBeats` reads it from a table keyed by act number, exactly like
`YUSUF_SCENE_BEAT_LABELS` directly above it. Fill in one line per act; the act
numbers must match `acts[].act` in the JSON.

The table is already wired through `io.ts` and **verified end to end**: a probe
label compiled into `output/67/corpus.json` and the freeze gate reported "all
authored (no TODO placeholders)", then the probe was reverted. Before that fix,
`io.ts` returned `{}` for every surah but 12 — you could have written all thirty
labels and the compiler would have silently ignored every one.

### 3. Recompile and re-check

```bash
cd v3/packages/corpus-compiler && npm run compile -- 67
node v3/scripts/content-freeze.mjs
```

## ONE THING TO EXPECT: your QA signature goes STALE

Recompiling changes the corpus hash. The freeze gate binds your signed QA sample
to a specific hash, so the moment 67 recompiles you will see:

```
surah 67: QA sample was taken against corpus 2ed7175147595241,
          current is <new> — STALE
```

That is the gate working, not breaking. Scene beats are *macro* content and do
not touch a single distractor, so the 34 items you signed are unchanged in
substance — but the gate cannot know that from a hash alone, and a gate that
guessed would be worthless. Expect to re-sign against the new hash. Worth
knowing BEFORE you write, so it is not a surprise afterwards.

## The scaffold's act divisions are a STARTING POINT, not a claim

It groups 30 ayat into 10 acts of 3. That is arithmetic, not exegesis — I have
no basis for asserting where Al-Mulk's narrative movements actually fall.
Merge, split and re-range the acts as the surah's real structure demands; the
only hard constraints the compiler enforces are that ranges are contiguous and
every ayah is covered exactly once.

## Fields, and what each is for

| Field | What it is | Reference from surah 12 |
|---|---|---|
| `name` | The act's title | "Overture: The Best of Stories" |
| `ayahRange` | `"1-3"` or `"7"` | contiguous, no gaps, no overlaps |
| `summary` | What happens, in plain prose | 2–3 sentences |
| `emotionalBeat` | What the learner should FEEL | "Anticipation — Allah Himself promises 'the BEST story.'" |
| `sceneImage` | A concrete mental picture | "A darkened cinema; a single spotlight hits a clear open Book…" |

`YUSUF_SCENE_BEAT_LABELS` in `packages/corpus-compiler/src/sceneBeats.ts` holds
the one-line labels for surah 12. Al-Mulk will need the equivalent — a
`MULK_SCENE_BEAT_LABELS` table, or the labels supplied through the same
`sceneBeatLabels` input `buildCorpus` already accepts.

## What is NOT blocked by this

Everything else. The engine, corpus, session loop, backend, sync, gates and the
route work all proceed independently — this blocks the **qari booking** only,
and booking a session before the content is frozen is what BUILD-PLAN says will
cost scholar hours twice.
