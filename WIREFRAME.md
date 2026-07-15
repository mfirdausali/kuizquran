# Kuiz Quran — App Flow Wireframe (ASCII)

_Low-fidelity screen wireframes + the flow between them. v1 scope: Surah Yusuf, minimal scenes (text + one still), learner loop first._

Legend:  `[ Button ]`   `( link )`   `▓▓░░ progress`   `→ leads to`   `🎬 image slot`

---

## 0 · THE MAP OF SCREENS (how everything connects)

```
                         ┌──────────────┐
                         │  SPLASH /    │
                         │  NIYYAH      │  (first-open + each session start)
                         └──────┬───────┘
                                │
                 first time ┌───┴────┐ returning
                            v        v
                   ┌─────────────┐   │
                   │ ONBOARDING  │   │
                   │ pick surah  │   │
                   └──────┬──────┘   │
                          └────┬─────┘
                               v
                     ╔═══════════════════╗   ◄── HOME BASE. everything returns here.
                     ║    STORY MAP      ║
                     ║  (the 19 acts)    ║
                     ╚═════╤═══════╤═════╝
              new act to    │       │   tap a done act
              unlock?       │       │   (revisit)
                            v       v
                  ┌──────────────┐  ┌──────────────┐
                  │ SCENE PLAYER │  │  ACT REVIEW  │
                  │ text + 🎬     │  │  (summary)   │
                  └──────┬───────┘  └──────────────┘
                         │ [ Start rebuilding → ]
                         v
              ╔═══════════════════════╗ ◄── THE CORE LOOP. repeats ~40×/session.
              ║      MCQ CARD          ║
              ║  cloze + 6 choices     ║ ──┐
              ╚═══════╤════════════════╝   │ next card
                      │ tap answer          │ (loops until
                      v                     │  scene done or
              ┌───────────────┐             │  satiety cap)
              │  FEEDBACK      │────────────┘
              │ ✓ / ✗ + why    │
              └───────┬────────┘
                      │ scene finished?
                      v
              ┌───────────────┐
              │ SCENE COMPLETE │  "6 words rescued. One more?"
              └───────┬────────┘
                      │
          ┌───────────┼────────────┐
          v           v            v
   [ One more ]  [ Back to map ] [ Done today ]
     → next act    → STORY MAP     → SESSION SUMMARY
                                        │
                                        v
                                  ┌───────────┐
                                  │  STREAK    │  🔥 + freeze token
                                  └───────────┘

   ── secondary tabs (bottom nav, always reachable) ──
      [ Learn ]   [ Progress ]   [ Profile ]
        home        garden/        settings,
        (map)       retention      niyyah, account
                    receipt
```

---

## 1 · SPLASH / NIYYAH  (every session opens here)

```
┌──────────────────────────────┐
│                              │
│            🌙                │
│                              │
│        Kuiz Quran            │
│                              │
│   "Before you begin —        │
│    renew your intention."    │
│                              │
│   ﴾ Bismillah ﴿              │
│                              │
│      [  Begin  ]             │
│                              │
└──────────────────────────────┘
     │
     └─► first launch → ONBOARDING
         returning     → STORY MAP
```

---

## 2 · ONBOARDING  (first launch only)

```
┌──────────────────────────────┐
│  ← 1 of 2                    │
│                              │
│  Where do you want to        │
│  start?                      │
│                              │
│  ┌────────────────────────┐  │
│  │ Surah Yusuf            │  │  ← the flagship (built)
│  │ 111 ayahs · the story  │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ Short surahs           │  │  ← casual on-ramp
│  │ Al-Ikhlas, Al-Kawthar… │  │
│  └────────────────────────┘  │
│                              │
│           [ Next → ]         │
└──────────────────────────────┘
              │
              v
┌──────────────────────────────┐
│  ← 2 of 2                    │
│                              │
│  How much time per day?      │
│                              │
│   ( ) 5 min   — gentle       │  ← sets daily due-cap
│   (•) 10 min  — steady       │
│   ( ) 15 min  — committed    │
│                              │
│  Remind me around:           │
│   [x] after Subuh            │  ← salah-time nudges
│   [x] before bed             │
│                              │
│        [ Start → ]           │
└──────────────────────────────┘
              │
              v  STORY MAP
```

---

## 3 · STORY MAP  (home base — the 19-act filmstrip)

```
┌──────────────────────────────┐
│  Surah Yusuf      🔥 12       │  ← streak flame
│  ────────────────────────────│
│  8 reviews due today          │  ← what the engine surfaces
│                              │
│  ✓ 1 · Overture      ▓▓▓▓    │  done (welded-ish)
│  ✓ 2 · The Dream     ▓▓▓▓    │
│  ✓ 3 · The Plot      ▓▓▓░    │
│  ✓ 4 · Deception     ▓▓▓░    │
│  ▶ 5 · The Pit       ▓░░░    │  ← CURSOR rests here (next)
│  🔒 6 · The Caravan            │  locked (gate not met)
│  🔒 7 · House of Aziz          │
│    … (12 more, locked)        │
│                              │
│   ┌────────────────────────┐  │
│   │  ▶  Continue — Act 5   │  │  ← the one glowing CTA
│   └────────────────────────┘  │
│  ────────────────────────────│
│  [Learn] [Progress] [Profile] │  ← bottom nav
└──────────────────────────────┘
      │                    │
  tap ▶/CTA            tap a ✓ act
      v                    v
  SCENE PLAYER         ACT REVIEW
```

> **The gate:** Act 6 unlocks only when Act 5's words reach young-review stability.
> You can't skip ahead → the surah builds end-to-end, in order.

---

## 4 · SCENE PLAYER  (minimal: text + one still)

```
┌──────────────────────────────┐
│  ←                  Act 5/19  │
│                              │
│  ┌────────────────────────┐  │
│  │                        │  │
│  │   🎬  [ still image ]  │  │  ← ONE symbolic illustration
│  │   a black well;        │  │    (no faces of prophets —
│  │   a bloodied shirt     │  │     the well, the shirt)
│  │                        │  │
│  └────────────────────────┘  │
│                              │
│  THE PIT & THE FALSE SHIRT   │  ← act name
│  Ayahs 15–18                 │
│                              │
│  They drop him into the      │  ← 1–2 sentence summary
│  well. The brothers return   │    (from mental-model data)
│  weeping with his shirt in    │
│  false blood. Yaqub: "sabr    │
│  jameel — beautiful patience."│
│                              │
│  [  Start rebuilding →  ]     │  ← into the drills
└──────────────────────────────┘
              │
              v  MCQ CARD
```

---

## 5 · MCQ CARD  (the core recall loop)

```
┌──────────────────────────────┐
│  Act 5 · the Pit    ▓▓░░░░    │  ← scene progress bar
│                              │
│  Tap the missing word:       │
│                              │
│   فَلَمَّا ذَهَبُوا۟ بِهِۦ ____      │  ← cloze (RTL Arabic)
│                              │
│  ┌───────────┐ ┌───────────┐ │
│  │  رُؤْياكَ   │ │  حَديثَكَ  │ │  ← 6 choices (correct + 5 traps)
│  └───────────┘ └───────────┘ │    tiers add distractors as
│  ┌───────────┐ ┌───────────┐ │    the word matures
│  │  قَولَكَ   │ │  أَمْرَكَ   │ │
│  └───────────┘ └───────────┘ │
│  ┌───────────┐ ┌───────────┐ │
│  │  سِرَّكَ   │ │  شَأْنَكَ   │ │
│  └───────────┘ └───────────┘ │
│                              │
└──────────────────────────────┘
              │ tap
              v  FEEDBACK
```

---

## 6 · FEEDBACK  (instant, machine-graded)

```
  ── if CORRECT ──               ── if WRONG ──
┌──────────────────────────┐   ┌──────────────────────────┐
│  فَلَمَّا … رُؤْياكَ ✓          │   │  correct: رُؤْياكَ            │
│                          │   │  you tapped: حَديثَكَ ✗       │
│  ✓  GOOD · 1.4s          │   │                          │
│                          │   │  ✗  AGAIN                 │
│  Interval extends.       │   │  Trap: "حَديثَكَ means      │
│  Next review in ~7 days. │   │  'your speech' — close in │
│                          │   │  meaning, wrong word."    │
│                          │   │  Stability damps (not     │
│                          │   │  zeroed). Back soon.      │
│      [ Next card → ]     │   │      [ Next card → ]      │
└──────────────────────────┘   └──────────────────────────┘
        │                              │
        └───────────┬──────────────────┘
                    v
        more cards? → loop back to MCQ CARD
        scene done? → SCENE COMPLETE
        cap hit?    → SATIETY CAP
```

---

## 7 · SCENE COMPLETE  ("one more successful recall")

```
┌──────────────────────────────┐
│           ✓                  │
│                              │
│    Scene 5 rebuilt.          │
│                              │
│  You rescued 6 words from    │  ← the completion beat
│  being forgotten.            │
│                              │
│  🌱 +6 to your garden        │
│  🔥 streak: 12 days          │
│                              │
│  (bonus, maybe:)             │  ← variable reward
│  ✨ "Notice — the SHIRT       │
│  appears here for the        │
│  first time. Track it."      │
│                              │
│  [ One more → ] [ Done today ]│
└──────────────────────────────┘
     │              │
  next act      SESSION SUMMARY
```

---

## 8 · SATIETY CAP  (the ethical brake)

```
┌──────────────────────────────┐
│           🌙                 │
│                              │
│  You've done well today.     │
│                              │
│  The rest is saved for       │  ← REFUSES to let you cram
│  tomorrow. Extra reps now    │    (backed by FSRS: undue
│  won't help you remember.     │     reps don't help)
│                              │
│  Come back after Subuh.      │
│                              │
│      [ See today's wins ]     │
└──────────────────────────────┘
              │
              v  SESSION SUMMARY
```

---

## 9 · SESSION SUMMARY / STREAK

```
┌──────────────────────────────┐
│  Today                       │
│  ────────────────────────────│
│  ✓ 14 recalls   ⏱ 6 min      │
│  🌱 6 words strengthened      │
│  ⚠ 2 words still at risk      │
│                              │
│      🔥  12 day streak        │
│   ❄ 1 freeze token saved     │  ← protects a missed day
│                              │
│  Next session: after Subuh   │
│                              │
│      [ Back to map ]          │
└──────────────────────────────┘
```

---

## 10 · PROGRESS TAB  (the garden + retention receipt)

```
┌──────────────────────────────┐
│  Your Quran Garden           │
│  ────────────────────────────│
│   🌳🌳🌳🌱🌱 ░░░              │  ← growth, not public metrics
│   38 of 111 ayahs rooted      │
│                              │
│  This month:                 │
│  ┌────────────────────────┐  │
│  │ 27 ayat kept that you  │  │  ← THE RETENTION RECEIPT
│  │ would have forgotten.  │  │    (the thing users pay for)
│  └────────────────────────┘  │
│                              │
│  Est. recall in 6 months:    │
│   ▓▓▓▓▓▓▓▓▓░  89%            │
│                              │
│  [Learn] [Progress] [Profile] │
└──────────────────────────────┘
```

---

## 11 · (LATER) OVERSIGHT SCREENS  — parent & teacher

Not in the learner v1, but the same recall data feeds these. Sketched for context.

```
  PARENT — Family Dashboard        TEACHER — Class Dashboard
┌──────────────────────────┐   ┌──────────────────────────┐
│  Nur · Surah Yusuf       │   │  Class 5A · today        │
│                          │   │                          │
│  Retention      94% ▓▓▓▓ │   │  ⚠ Highest forgetting:   │
│  Vocabulary     83% ▓▓▓░ │   │    Ayah 37 · 18/24       │
│  Recall @6mo    89% ▓▓▓▓ │   │                          │
│                          │   │  [ Review in class today ]│
│  "27 ayat kept this week"│   │  ( drill into a student )│
└──────────────────────────┘   └──────────────────────────┘
   parents buy CONFIDENCE          teachers buy PREDICTION
```

---

## THE FLOW IN ONE BREATH

```
 Niyyah → Story Map → (unlock) Scene → drill MCQ ⟳ → Scene Complete →
 "one more?" → … → Satiety Cap → Session Summary → 🔥 streak → close.

 Tomorrow: Niyyah → Story Map (engine surfaces due reviews) → repeat.

 The user almost never chooses WHAT to study.
 The engine surfaces it. The user just shows up and taps.
```
