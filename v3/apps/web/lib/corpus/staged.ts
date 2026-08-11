// WHICH SURAHS ARE STAGED FOR THE BROWSER — the constant, with no boundary on it.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A SEPARATE FILE FROM `client.ts`
// ---------------------------------------------------------------------------
// `CLIENT_SURAHS` used to live in `lib/corpus/client.ts`, which carries a
// `"use client"` directive. That directive makes the module a CLIENT BOUNDARY:
// when a Server Component imports from it, React does not hand back the value —
// it hands back a client reference proxy standing in for the module. Reading a
// plain constant through that proxy does not give you the array.
//
// This is not theoretical. `/library` is a Server Component that needs to know
// which surahs the browser can drill, and importing the constant from
// `client.ts` made the production build fail while every other gate stayed
// green:
//
//     TypeError: f.CLIENT_SURAHS.includes is not a function
//     Error occurred prerendering page "/library"
//
// `tsc --noEmit` passed (the types are real), `check-boundaries.mjs` passed
// (no clause covers this), and the jsdom tests passed (there is no RSC boundary
// in jsdom). Only `next build` caught it, on the prerender. A constant that is
// read from BOTH sides of the boundary therefore cannot live behind the
// directive — it has to live in a module with no directive at all, which both
// sides may import. That is this file, and that is its whole job.
//
// `client.ts` re-exports it, so every existing importer is unaffected and there
// is still only ONE definition of the list.

/**
 * Surahs staged into `public/corpus/` by `scripts/stage-corpus.mjs`.
 *
 * This list and that script's own `CLIENT_SURAHS` are the same decision written
 * twice; `test/onboarding.test.tsx` asserts they agree, so a surah added to one
 * and not the other fails a test rather than 404-ing at runtime.
 *
 * Surah 12 is deliberately absent and must stay absent: it is 3.4 MB compiled
 * and is served from disk by `lib/corpus/load.ts` instead of being shipped to a
 * browser.
 */
export const CLIENT_SURAHS: readonly number[] = [112, 103, 67];
