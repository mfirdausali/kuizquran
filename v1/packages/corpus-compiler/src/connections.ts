// Connection atoms: ayah n → n+1. For Surah Yusuf (111 ayat) this is exactly
// 110 connections. PRD invariant: connections are first-class atoms.

import type { Connection } from "./types.ts";

export function buildConnections(ayahCount: number): Connection[] {
  const out: Connection[] = [];
  for (let n = 1; n < ayahCount; n++) out.push({ from: n, to: n + 1 });
  return out;
}
