# Al-Mulk (67) scene beats — the one thing agents must not write

**Status: BLOCKED ON FIRDAUS. This is the only remaining content-freeze blocker.**

## Why this file exists instead of the content itself

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

## How to fill it in

1. Open `v3/packages/corpus-compiler/data/raw/67-mental-model.SCAFFOLD.json`.
2. Replace every `"TODO"`. The structure mirrors
   `12-mental-model.json`, which is your own authored work and the best
   reference for tone and length.
3. Rename it to `67-mental-model.json`. **The compiler only reads that exact
   name** — the `.SCAFFOLD.` infix is deliberate, so placeholder text can never
   be compiled into a shipped corpus by accident.
4. Recompile 67, then re-run the freeze gate.

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
