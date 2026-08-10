# The golden log

Step 2 of `v3/docs/BUILD-PLAN.md`'s corrected build order: "Pin v2 SHA; cut
golden log + fixtures from it."

## Provenance

- **Cut from:** `v2` at `c34f5c3` (the parity oracle SHA named in
  `v3/CLAUDE.md`). No `v2` engine file has changed since — the only later
  commit touching the `v2` tree (`283dab8`) added `.env.example` harness
  files, not engine code.
- **Generator:** `v3/scripts/gen-golden-log.ts` — imports `v2/src/engine/src/{events,rebuild,daybound}.ts`
  read-only (never edits `v2`), builds a `DrillEvent[]`, folds it once through
  v2's own `rebuild()`, and writes both files below. Regenerate with
  `make golden-log` (requires `TZ=UTC`, enforced by the script itself — see
  "Why TZ=UTC" below).
- **`events.json`** — the append-only log, 24 events, surah 12 (Yusuf) only.
- **`oracle.json`** — `rebuild(events, DEFAULT_DAY_CONFIG)`, i.e. the atoms
  cache v2 itself produces from that log. This is the committed fold-parity
  oracle for `v3/docs/BUILD-PLAN.md` step 6 (golden-log fold-parity snapshot),
  which will assert the *ported* v3 engine reproduces it byte-for-byte before
  E-01 keys the atoms by surah.

## No Quranic Arabic

`DrillEvent.choice` (the tapped answer text) is never populated. Checked
mechanically: `rebuild()`/`applyEvent()` never read `choice` — the fold
depends only on `type`, `ts`, `surah`, `ayah`, `rung`, `correct`, `pretest`,
`structured`, `to`, `stepKind`. Every event below is pure structural
coordinates (surah/ayah/position numbers), never Arabic text, satisfying
Absolute B without needing a placeholder.

## Why `TZ=UTC`

`v2/src/engine/src/daybound.ts:23` computes the learning-day boundary with
`new Date(now).getFullYear()/getMonth()/getDate()` — machine-**local** date
getters (`v3/INVARIANTS.md` Absolute A names this exact leak). The oracle is
only reproducible if every generation run pins the same TZ, so the script
refuses to run unless `process.env.TZ === "UTC"`. This is not a bug we fix
here — the tz-explicit rewrite is `v3/docs/BUILD-PLAN.md` step 8. Event g07
(below) exists specifically so that step's regression test has a fixture
that already discriminates rollover-aware from naive-calendar-date grouping.

## Trigger-event coverage

Cross-referenced against `v3/INVARIANTS.md`'s property pack and
`v3/DEFECTS.md`.

| Invariant / defect | Events | What it proves in the oracle |
|---|---|---|
| Inv 1 — atom is the AYAH, never per-word | g01–g02 (ayah 1), g20 (ayah 7, a raw word-level `tap`) | Only `ayah:*`/`connection:*` keys ever appear — `rebuild.ts`'s `atomKey` space has no `"word"` kind, so a word tap rolls up to `ayah:7` directly. |
| Inv 2 — event log is truth, fold is rebuildable | the whole log | `oracle.json` is nothing but `rebuild(events)` — re-running the generator must reproduce it byte-for-byte. |
| Inv 3 — pretest excluded from strength | g01 (ayah 1, `pretest:true, correct:false`) | `ayah:1`'s final `reps:1` — only g02 (the real S1 pass) counted; g01 moved nothing. |
| Inv 4 — evidence asymmetry: massed ×0.35 | g03–g05 (ayah 2: massed pair same day, then a spaced pass next day) | `ayah:2.strength = 12.5304` — hand-verified: 5.28 (fresh) → +1.8732 (massed ×0.35) → +5.3772 (spaced, full weight). |
| Inv 4 — spacing between RETRIEVALS, not app-opens; the 23:50/00:10 pair | g06–g07 (ayah 3) | `ayah:3.strength = 7.1532` — the SAME arithmetic as a massed pair (rolloverHour 4.5 groups 23:50 and the next day's 00:10 into one learning-day). A naive calendar-date bug would instead compute 10.632 (both treated as spaced). |
| Inv 4 — post-lapse stability damped ×0.4, never zeroed | g08–g10 (ayah 4: encode, a *spaced* gate pass to clear the reinforce band, then a lapse) | `ayah:4.lapses = 1`, `stability = 2.4832` (= 6.208 × 0.4, not 0), `strength = 11.728` (dropped 45, not to 0). |
| Inv 4 — errors carry full weight even in Learn band | g22 (ayah 11 gate fail, pre-fail strength 26.4 < 40) | `ayah:11.strength = 11.4` (−15, the Learn-band branch — contrast with ayah 4's Reinforce-band lapse branch above). |
| Inv 5 — only structured sessions mutate lifecycle (free play) | g11 (ayah 5, `structured:false`) | `ayah:5` exists (created by `getAtom`) but every field is still its `initAtom` default — `update()` returned it untouched. |
| Inv 5 — `test_*` is a read-only mirror, no fold branch at all | g12–g14 (ayah 6: `test_start`/`test_answer`/`test_result`) | `ayah:6` is **absent** from `oracle.json` — `rebuild.ts` has no branch for these types, so `getAtom` is never even called. |
| B (v2-BUG-3) — chain-step gap guard | g21 (ayah 10, `chain_step` over a never-encoded ayah) | `ayah:10` is **absent** — a step credits only an atom that already exists (and, for an ayah step, is already `encoded`). |
| Connection atoms (Inv 1's "and the CONNECTION") | g15–g17 (ayah 8→9: birth, junction, chain-step) | `connection:8.reps = 2`, `encoded:false` (connections don't carry an `encoded` gate the way ayat do). |
| Gate forgiveness ladder | g18–g20 (ayah 11: encode → cold-gate fail → accepted demote), g23 (ayah 12: demote with no atom) | `ayah:11.encoded:false, gateFails:0` after the accepted demote (`demoteToLearn` resets the ladder); `ayah:12` absent — `gate_demote` on a never-created atom is a no-op. |
| Events with no fold signal at all | g24 (ayah 13, `interruption`) | `ayah:13` absent, alongside the other non-folding types already covered above (`test_*`). |

## Regenerating

Oracle regeneration is a first-class, human-reviewed protocol
(`v3/docs/BUILD-PLAN.md`'s acceptance protocol) — never a step an
implementing agent takes to make its own tests pass. There is currently
nothing that should ever require regenerating this file: `v2` is frozen.
If `v2`'s engine ever legitimately changes (it must not), or the trigger
table above needs a new case, run `make golden-log`, diff both JSON files by
hand, and get that diff reviewed before committing.
