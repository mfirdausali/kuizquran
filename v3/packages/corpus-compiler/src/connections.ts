// Connection atoms: ayah n → n+1, within ONE surah. Ported from
// v1/packages/corpus-compiler/src/connections.ts, surah-parameterized (E-01):
// every connection row now names its surah so a fold can never merge Yusuf's
// connection:5 with a second surah's connection:5.

import type { Connection } from "./types.ts";

export function buildConnections(surah: number, ayahCount: number): Connection[] {
  const out: Connection[] = [];
  for (let n = 1; n < ayahCount; n++) out.push({ surah, from: n, to: n + 1 });
  return out;
}
