# Fonts — provenance, licences, and what is MISSING

This directory backs the `@font-face` block in `app/iman-ui.css`, which is the ONE
documented delta versus the locked `v1/styles/iman-ui.css` (edge case #83 — an
`@import` to fonts.googleapis.com breaks offline, and this app must drill in
airplane mode).

`scripts/check-fonts.mjs` runs on every `npm run build` (via `prebuild`) and reads
the `src:` URLs straight out of `app/iman-ui.css`. It is the reason a missing font
cannot be shipped silently.

## Status — 2 of 6 present

| File | Family / weight | Present | Source |
|---|---|---|---|
| `amiri-400.woff2` | Amiri 400 | **YES** | converted on this machine from `~/Library/Fonts/Amiri-Regular.ttf` |
| `amiri-700.woff2` | Amiri 700 | **YES** | converted on this machine from `~/Library/Fonts/Amiri-Bold.ttf` |
| `inter-400.woff2` | Inter 400 | **NO** | see "Acquiring the missing four" |
| `inter-500.woff2` | Inter 500 | **NO** | " |
| `inter-600.woff2` | Inter 600 | **NO** | " |
| `source-serif-4-400.woff2` | Source Serif 4 400 | **NO** | " |

### Why the split is not arbitrary

**Amiri is the product.** It is `--font-arabic`, the face every Quranic glyph in
the app is painted in, and per invariant 5 the ayah is the largest type on every
screen. Without it the ayah falls back to a generic serif that may not map
Quranic codepoints at all and renders tofu (edge case #84). So a build with
Amiri missing is a **hard failure** — `check-fonts.mjs` exits 1.

**Inter and Source Serif 4 are UI chrome.** They are the open stand-ins for the
commercial Styrene B / Tiempos Text. When absent, the locked token stacks fall
through to the fallbacks they *already name themselves*:

```
--font-ui:    "Styrene B", "Inter", ui-sans-serif, system-ui, ... ← lands on system UI face
--font-voice: "Tiempos Text", "Source Serif 4", Georgia, serif   ← lands on Georgia
```

That is a graceful, designed degradation, so their absence is a **loud warning on
every build**, not a failure. This asymmetry is a product judgment, logged as
v3-D40 in `v3/DECISIONS.md` — it is not merely a script's exit code.

## Amiri — verified provenance

Read from the font's own `name` table on 2026-08-11 (not from memory):

- **Copyright**: 2010-2020 The Amiri Project Authors (https://github.com/alif-type/amiri)
- **Version**: 0.113
- **Licence**: SIL Open Font License, Version 1.1 (nameID 13) — https://scripts.sil.org/OFL
- Full licence text: `OFL-Amiri.txt` in this directory.

Codepoint coverage verified before shipping (by codepoint NUMBER — this repo never
writes Quranic Arabic literals, per the sacred-text rule):

- Arabic U+0600-06FF: 254 codepoints mapped
- Arabic Supplement U+0750-077F: 48
- Arabic Presentation Forms-A U+FB50-FDFF: 611
- Arabic Presentation Forms-B U+FE70-FEFF: 140
- **Quranic annotation marks U+06D6-06ED: 24/24 mapped**

Conversion command actually run (TTF → WOFF2, 553KB → 156KB / 531KB → 146KB):

```bash
fonttools ttLib.woff2 compress -o public/fonts/amiri-400.woff2 ~/Library/Fonts/Amiri-Regular.ttf
fonttools ttLib.woff2 compress -o public/fonts/amiri-700.woff2 ~/Library/Fonts/Amiri-Bold.ttf
```

Attribution for Amiri must appear on the QAC/Tanzil attribution page that M10 ships.

## Acquiring the missing four

These could not be fetched in the sandbox that produced this scaffold (no network
access was used). Whoever next has a network runs these and drops the output here.
**Both are SIL OFL 1.1 and MUST be committed to the repo as self-hosted copies** —
never referenced from a CDN, which would reintroduce exactly the offline breakage
that killed the `@import`.

### Inter 400 / 500 / 600 — https://github.com/rsms/inter/releases

```bash
cd /tmp
curl -L -o inter.zip https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip
unzip -o inter.zip -d inter
# The release ships variable + static webfonts. Take the static woff2 for the
# three weights the locked design system actually uses:
DEST=v3/apps/web/public/fonts
cp inter/extras/woff2/InterDisplay-Regular.woff2  $DEST/inter-400.woff2
cp inter/extras/woff2/InterDisplay-Medium.woff2   $DEST/inter-500.woff2
cp inter/extras/woff2/InterDisplay-SemiBold.woff2 $DEST/inter-600.woff2
# Verify the paths inside the archive first — rsms/inter has reorganised its
# zip layout between releases. `unzip -l inter.zip | grep woff2` before copying.
cp inter/LICENSE.txt $DEST/OFL-Inter.txt
```

Weight 500 is required by the locked file's `.btn--primary` (`font-weight: 500`);
600 is used by headings in the extension layer.

### Source Serif 4 400 — https://github.com/adobe-fonts/source-serif/releases

```bash
cd /tmp
curl -L -o source-serif.zip https://github.com/adobe-fonts/source-serif/releases/download/4.005R/source-serif-4.005R.zip
unzip -o source-serif.zip -d source-serif
cp source-serif/**/WOFF2/*/SourceSerif4-Regular.otf.woff2 \
   v3/apps/web/public/fonts/source-serif-4-400.woff2
cp source-serif/LICENSE.md v3/apps/web/public/fonts/OFL-SourceSerif.txt
```

After dropping the files in, `npm run build` prints `fonts: 6/6 present` and the
warning disappears. No code change is needed — the `@font-face` rules are already
written and correct; they are merely unsatisfied for these four today.

## Do NOT subset these fonts yet

Edge case #84 requires a build-time glyph check over EVERY compiled corpus, per
surah. That check belongs with the corpus (M1/M5 shared). Subsetting before it
exists risks silently dropping a codepoint some surah needs. Ship the full face,
measure, then subset behind that check.
