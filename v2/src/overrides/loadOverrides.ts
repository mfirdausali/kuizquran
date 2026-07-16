// v2-D21/D55/D56: fetches the question-bank override layer from Laravel's
// PUBLIC GET /overrides (no auth — every device, including an anonymous one,
// must resolve overrides at question-build time). Offline/API-failure is
// swallowed and returns [] — local-first (v2-D01): the app must still work
// fully offline, just without any not-yet-cached override corrections.

import type { QuestionOverride } from "engine";
import { API_URL } from "../sync/auth.ts";

interface WireOverride {
  id: number;
  surah: number;
  ayah: number;
  position: number | null;
  question_type: string;
  field: QuestionOverride["field"];
  payload: unknown;
  editor_id: number | null;
  note: string | null;
  created_at: number;
}

function fromWire(w: WireOverride): QuestionOverride {
  return {
    id: w.id,
    surah: w.surah,
    ayah: w.ayah,
    position: w.position,
    questionType: w.question_type,
    field: w.field,
    payload: w.payload,
    editorId: w.editor_id,
    note: w.note,
    createdAt: w.created_at,
  };
}

export async function loadOverrides(surah: number): Promise<QuestionOverride[]> {
  try {
    const res = await fetch(`${API_URL}/overrides?surah=${surah}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { overrides?: WireOverride[] };
    if (!Array.isArray(body.overrides)) return [];
    return body.overrides.map(fromWire);
  } catch {
    return [];
  }
}
