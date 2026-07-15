// Join the fused Yusuf inputs + QAC morphology into the six-table CorpusJson.
// Pure: takes already-parsed inputs, returns the corpus object. No I/O here.

import type {
  CorpusJson,
  Distractor,
  RawMcqItem,
  RawMentalModel,
  RawVerse,
  Verse,
  Word,
  WordMorph,
  WordRef,
} from "./types.ts";
import { buildConnections } from "./connections.ts";
import { buildLookAlikes } from "./lookalikes.ts";
import { ayahToAct, buildSceneBeats } from "./sceneBeats.ts";
import { mapPrdRank } from "./prdRank.ts";

export interface BuildInputs {
  verses: RawVerse[];
  mcqItems: RawMcqItem[];
  mentalModel: RawMentalModel;
  /** surah-12 morphology keyed "ayah:position". */
  morph: Map<string, WordMorph>;
  generatedFrom: string[];
}

export function buildCorpus(inp: BuildInputs): CorpusJson {
  const { verses, mcqItems, mentalModel, morph } = inp;

  const ayahCount = verses.length;
  const actByAyah = ayahToAct(mentalModel.acts);

  // Index morphology + the mcq target root, for distractor rank mapping.
  const morphOf = (ayah: number, position: number): WordMorph =>
    morph.get(`${ayah}:${position}`) ?? { lemma: null, root: null, class: null };

  // Root lookup for any Yusuf word form (to detect same-root distractors that
  // happen to also be Yusuf words). Keyed by normalized-free exact text match on
  // the mcq `word`/`correct`; here we only have roots for target positions, so
  // the distractor root is looked up when the distractor equals a known target
  // form. That is best-effort — most distractors are out-of-surah.
  const rootByText = new Map<string, string>();
  for (const item of mcqItems) {
    const m = morphOf(item.verse, item.position);
    if (m.root) rootByText.set(item.correct, m.root);
  }

  // ---- verses ----
  const versesOut: Verse[] = verses.map((v) => ({
    ayah: v.verse_number,
    text_uthmani: v.text_uthmani.trim(),
    page: null, // no mushaf geometry source in v0.1
    line: null,
  }));

  // ---- words ----
  const glossByPos = new Map<string, string>();
  for (const v of verses) {
    for (const w of v.words) glossByPos.set(`${v.verse_number}:${w.position}`, w.translation);
  }
  const wordsOut: Word[] = [];
  for (const v of verses) {
    const act = actByAyah.get(v.verse_number) ?? null;
    for (const w of v.words) {
      const m = morphOf(v.verse_number, w.position);
      wordsOut.push({
        ayah: v.verse_number,
        position: w.position,
        text_uthmani: w.text_uthmani,
        lemma: m.lemma,
        root: m.root,
        class: m.class,
        gloss: { en: w.translation, ms: null, ja: null },
        act: act ? act.act : null,
        sceneImage: act ? act.sceneImage : null,
      });
    }
  }

  // ---- distractors (drop self-collisions, map prd_rank, preserve order) ----
  const distractorsOut: Distractor[] = [];
  const droppedCollisions: WordRef[] = [];
  for (const item of mcqItems) {
    const targetMorph = morphOf(item.verse, item.position);
    let rank = 0;
    let droppedHere = false;
    for (const d of item.distractors) {
      if (d.text === item.correct) {
        droppedHere = true;
        continue; // drop self-collision; do not advance rank
      }
      rank++;
      const prd_rank = mapPrdRank({
        targetText: item.correct,
        targetRoot: targetMorph.root,
        distractorText: d.text,
        distractorRoot: rootByText.get(d.text) ?? null,
        srcType: d.type,
      });
      distractorsOut.push({
        ayah: item.verse,
        position: item.position,
        rank,
        text: d.text,
        prd_rank,
        src_type: d.type,
        why: d.why,
      });
    }
    if (droppedHere) droppedCollisions.push({ ayah: item.verse, position: item.position });
  }

  // ---- connections / lookalikes / scene beats ----
  const connections = buildConnections(ayahCount);
  const lookalikes = buildLookAlikes(verses);
  const sceneBeats = buildSceneBeats(mentalModel.acts);

  return {
    meta: {
      surah: 12,
      ayahCount,
      wordCount: wordsOut.length,
      generatedFrom: inp.generatedFrom,
      droppedCollisions,
    },
    verses: versesOut,
    words: wordsOut,
    distractors: distractorsOut,
    connections,
    lookalikes,
    sceneBeats,
  };
}
