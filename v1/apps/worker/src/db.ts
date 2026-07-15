// Typed D1 helpers. The wire event shape mirrors the client DrillEvent.

export interface WireEvent {
  id: string;
  type: string;
  ts: number;
  surah?: number;
  ayah?: number;
  rung?: string;
  position?: number;
  choice?: string;
  correct?: boolean;
  pretest?: boolean;
  to?: number;
  stepKind?: "ayah" | "junction";
  structured?: boolean; // false = free-play evidence (invariant #4/#5); absent ⇒ structured
  latency?: number; // v0.6 time-per-word
  resume?: string; // v0.6 interruption classification
}

/** Upsert (idempotent) a user by google_sub; returns the user id. */
export async function upsertUser(
  db: D1Database,
  sub: string,
  email: string,
  nowMs: number,
): Promise<number> {
  await db
    .prepare("INSERT OR IGNORE INTO users (google_sub, email, created_at) VALUES (?, ?, ?)")
    .bind(sub, email, nowMs)
    .run();
  const row = await db
    .prepare("SELECT id FROM users WHERE google_sub = ?")
    .bind(sub)
    .first<{ id: number }>();
  if (!row) throw new Error("user upsert failed");
  return row.id;
}

/**
 * Insert a batch of events for a user, idempotent by event id (INSERT OR IGNORE).
 * Returns how many were newly accepted vs ignored (already present).
 */
export async function insertEvents(
  db: D1Database,
  userId: number,
  events: WireEvent[],
  receivedAt: number,
): Promise<{ accepted: number; ignored: number }> {
  if (events.length === 0) return { accepted: 0, ignored: 0 };
  const before = await countEvents(db, userId);
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO events
      (id, user_id, type, ts, surah, ayah, rung, position, choice, correct, pretest, to_ayah, step_kind, structured, latency, resume, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const batch = events.map((e) =>
    stmt.bind(
      e.id,
      userId,
      e.type,
      e.ts,
      e.surah ?? null,
      e.ayah ?? null,
      e.rung ?? null,
      e.position ?? null,
      e.choice ?? null,
      e.correct === undefined ? null : e.correct ? 1 : 0,
      e.pretest === undefined ? null : e.pretest ? 1 : 0,
      e.to ?? null,
      e.stepKind ?? null,
      e.structured === undefined ? null : e.structured ? 1 : 0,
      e.latency ?? null,
      e.resume ?? null,
      receivedAt,
    ),
  );
  await db.batch(batch);
  const after = await countEvents(db, userId);
  const accepted = after - before;
  return { accepted, ignored: events.length - accepted };
}

export async function countEvents(db: D1Database, userId: number): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM events WHERE user_id = ?")
    .bind(userId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * All of a user's events in append order (ts, then received_at as a tiebreak),
 * mapped back to the WireEvent shape for the server→client hydrate pull. NULL
 * columns become `undefined`; `structured` NULL (legacy rows) is left undefined
 * so the client/engine apply their default (structured = true, i.e. not free-play).
 */
export async function selectEvents(db: D1Database, userId: number): Promise<WireEvent[]> {
  const { results } = await db
    .prepare(
      `SELECT id, type, ts, surah, ayah, rung, position, choice, correct, pretest,
              to_ayah, step_kind, structured, latency, resume
         FROM events WHERE user_id = ? ORDER BY ts ASC, received_at ASC`,
    )
    .bind(userId)
    .all<{
      id: string; type: string; ts: number; surah: number | null; ayah: number | null;
      rung: string | null; position: number | null; choice: string | null;
      correct: number | null; pretest: number | null; to_ayah: number | null;
      step_kind: string | null; structured: number | null; latency: number | null;
      resume: string | null;
    }>();
  return results.map((r) => {
    const e: WireEvent = { id: r.id, type: r.type, ts: r.ts };
    if (r.surah !== null) e.surah = r.surah;
    if (r.ayah !== null) e.ayah = r.ayah;
    if (r.rung !== null) e.rung = r.rung;
    if (r.position !== null) e.position = r.position;
    if (r.choice !== null) e.choice = r.choice;
    if (r.correct !== null) e.correct = r.correct === 1;
    if (r.pretest !== null) e.pretest = r.pretest === 1;
    if (r.to_ayah !== null) e.to = r.to_ayah;
    if (r.step_kind !== null) e.stepKind = r.step_kind as "ayah" | "junction";
    if (r.structured !== null) e.structured = r.structured === 1;
    if (r.latency !== null) e.latency = r.latency;
    if (r.resume !== null) e.resume = r.resume;
    return e;
  });
}
