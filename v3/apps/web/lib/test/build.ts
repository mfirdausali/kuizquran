// ASSEMBLING A MIXED TEST — v2 Phase 4 (v2-D13), the piece
// `packages/engine/src/test.ts`'s own header names as never having a caller:
// "a Test's raison d'être is a real, unpredictable mixed quiz, so — exactly
// like the UI already shuffles tile DISPLAY order — the UI also picks WHICH
// (kind, ayah) pairs make the Test and in what order."
//
// So this module is that picking, and nothing else. Every ITEM is built by
// one of `test.ts`'s own generators — vocab/cloze/junction/locate/produce
// reuse the exact ladder/options/chain machinery the Learn loop already uses
// (invariant #6) — this file only decides which generator runs on which ayah,
// which is deliberately a UI-layer decision the engine's own header says is
// not its job.
//
// `shuffle` is INJECTED rather than called here, so this module stays pure
// and this file's own tests can pin exact output against a stub shuffle
// (identity, or a fixed permutation) instead of asserting on randomness. The
// caller (`TestIsland`) passes a real `Math.random`-backed shuffle — Test's
// item SELECTION is meant to be unpredictable, unlike a rendered option
// bank's DISPLAY order, which must stay seeded and re-render-stable
// (`lib/onboarding/pass.ts#displayOrder`'s own header explains that
// distinction; this file is the other side of it).
//
// NO ARABIC IS WRITTEN HERE. `ayahSnippet` reads `text_uthmani` back OUT of
// corpus rows at runtime; it never supplies a byte of its own.

import type { Corpus, GlossLang } from "@engine/types.ts";
import { ayahWords } from "@engine/corpus.ts";
import { isQuestionDisabled, type DisabledQuestion } from "@engine/overrides.ts";
import {
  clozeItem,
  junctionTestItem,
  locateItem,
  produceItem,
  reorderItem,
  vocabItem,
  type TestItem,
} from "@engine/test.ts";

/** Not exported by `test.ts` itself — derived here rather than added to the
 *  engine for one app-layer convenience alias. */
export type TestItemKind = TestItem["kind"];

/** A pure array permutation. `Array.prototype.slice` + `Math.random`-driven
 *  Fisher-Yates in the real caller; a stub (identity, reverse, a fixed
 *  perm) in tests. Never mutates its argument. */
export type Shuffle = <T>(items: readonly T[]) => T[];

const ITEM_COUNT = 6;
const KIND_ORDER: readonly TestItemKind[] = ["vocab", "cloze", "junction", "locate", "produce"];

/**
 * The (ayah, position) an override's `disable` row targets for one TestItem.
 * `position` is null for kinds that are not a single-word probe (v2-D55:
 * disable resolution is scoped to what the override editor can express) —
 * an ayah-wide row (`position: null`) then covers every position of that
 * questionType, which is `isQuestionDisabled`'s own rule.
 *
 * Ported verbatim from `v2/src/pages/Test.tsx#itemDisableKey` (read-only port
 * source, never edited). It is exported because the disable decision it
 * encodes is the same one the admin/qari side must be able to express: the
 * key shape IS the contract between the two halves.
 */
export function itemDisableKey(item: TestItem): { ayah: number; position: number | null } {
  switch (item.kind) {
    case "vocab":
      return { ayah: item.ayah, position: item.position };
    case "cloze":
      return { ayah: item.ayah, position: item.blankPosition };
    case "junction":
      return { ayah: item.from, position: null };
    case "reorder":
      return { ayah: item.ayahs[0]!, position: null };
    default:
      return { ayah: item.ayah, position: null };
  }
}

/**
 * Build one mixed Test over `pool` (an inclusive ascending ayah range).
 * Mirrors v2's own `buildItems` (`v2/src/pages/Test.tsx`): up to `ITEM_COUNT`
 * items cycling `KIND_ORDER` against a shuffled draw from the pool, a
 * junction request on the range's last ayah degrades to cloze (there is no
 * n+1 to ask about), and — v2-D13's explicit named list — a chaining-reorder
 * item is appended whenever the range spans at least 2 consecutive ayat.
 * The final order is shuffled again so the reorder item (always built last)
 * does not always land last on screen.
 *
 * `disabled` is the resolved active-disable list from
 * `applyOverrides(...).disabled` — REQUIRED, never defaulted, so a caller
 * cannot silently opt out of qari corrections the way v3's original port of
 * this function did by simply omitting the parameter.
 */
export function buildTestItems(
  corpus: Corpus,
  surah: number,
  pool: readonly number[],
  lang: GlossLang,
  disabled: readonly DisabledQuestion[],
  shuffle: Shuffle,
): TestItem[] {
  if (pool.length === 0) return [];
  const order = shuffle(pool);
  const count = Math.min(ITEM_COUNT, order.length);
  const items: TestItem[] = [];

  for (let i = 0; i < count; i++) {
    const ayah = order[i]!;
    const kind = KIND_ORDER[i % KIND_ORDER.length]!;
    if (kind === "junction" && ayah + 1 > corpus.meta.ayahCount) {
      items.push(clozeItem(corpus, ayah));
      continue;
    }
    switch (kind) {
      case "vocab":
        items.push(vocabItem(corpus, surah, ayah, lang));
        break;
      case "cloze":
        items.push(clozeItem(corpus, ayah));
        break;
      case "junction":
        items.push(junctionTestItem(corpus, ayah));
        break;
      case "locate":
        items.push(locateItem(corpus, ayah, order));
        break;
      case "produce":
        items.push(produceItem(ayah));
        break;
    }
  }

  // Bounded by `pool.length` as well as the corpus tail — NOT just the
  // corpus tail, which is what v2's own `buildItems` used alone. That let a
  // reorder item spill past the learner's OWN chosen range (e.g. a pool of
  // exactly `[N]` still built a 3-ayah reorder over N..N+2): a Test billed as
  // "a range you choose" that quietly quizzes ayat outside it. Fixed here
  // rather than ported verbatim — this is new v3 construction, not a port of
  // engine behaviour bound by parity.
  const reorderFrom = Math.min(...pool);
  const reorderCount = Math.min(3, pool.length, corpus.meta.ayahCount - reorderFrom + 1);
  if (reorderCount >= 2) items.push(reorderItem(reorderFrom, reorderCount));

  // v2-D21/D55, verbatim from the port source's own comment: "a qari-disabled
  // question never surfaces in a Test — filtered out post-generation rather
  // than backfilled (a Test that started with a disabled item just runs
  // slightly shorter; no silent replacement item)." Backfilling would defeat
  // the point: the reason a question is disabled is that it is WRONG, and
  // reaching for a replacement at the same coordinate risks serving the next
  // variant of the same bad item.
  const live = items.filter((it) => {
    const key = itemDisableKey(it);
    return !isQuestionDisabled([...disabled], key.ayah, key.position, it.kind);
  });

  return shuffle(live);
}

/** The ayah a `test_answer`/wire event should be stamped against — a
 *  junction's `from` and a reorder's first ayah, everything else its own
 *  `ayah` field. */
export function itemAyah(item: TestItem): number {
  if (item.kind === "junction") return item.from;
  if (item.kind === "reorder") return item.ayahs[0]!;
  return item.ayah;
}

/** A short reading-order snippet of one ayah's surface text, for a reorder
 *  tile's label — corpus bytes only, read at call time, never a literal. */
export function ayahSnippet(corpus: Corpus, ayah: number, n = 4): string {
  return ayahWords(corpus, ayah)
    .slice(0, n)
    .map((w) => w.text_uthmani)
    .join(" ");
}
