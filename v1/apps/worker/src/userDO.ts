// UserDO — one Durable Object per user (PRD §9: "DO per user"). It serializes
// a user's event writes: because a DO is single-threaded per id, two concurrent
// /events batches for the same user cannot race. It persists to D1 (the durable,
// admin-queryable event store) with an idempotent INSERT OR IGNORE by event id.
//
// This is also the natural home for later per-user state (atoms cache, streak —
// v0.8); for v0.5 it only coordinates the append.

import type { Env } from "./env.ts";
import { insertEvents, type WireEvent } from "./db.ts";

interface IngestBody {
  userId: number;
  events: WireEvent[];
}

export class UserDO {
  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/ingest") {
      const body = (await request.json()) as IngestBody;
      // blockConcurrencyWhile serializes this user's ingests end-to-end.
      const result = await this.state.blockConcurrencyWhile(async () =>
        insertEvents(this.env.DB, body.userId, body.events, Date.now()),
      );
      return Response.json(result);
    }
    return new Response("not found", { status: 404 });
  }
}
