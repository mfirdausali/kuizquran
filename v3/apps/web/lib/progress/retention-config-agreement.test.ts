// v3-D263 — `retention.ts#REVIEW_RISK_THRESHOLD`/`CONNECTION_WEIGHT` were each
// an INDEPENDENT re-declaration of a value `scheduler.ts` also decides
// (`0.15` inline at the review filter; `DEFAULT_CONN_WEIGHT`, module-private)
// — `retention.ts`'s own docblock said so plainly: "Duplicated... because the
// engine does not export it." The exact "two implementations of one
// decision, no shared source" shape this build has repeatedly closed
// elsewhere (`gradeClassToWire` v3-D83, `lastActiveDayMs` v3-D113,
// `digestsMatch` v3-D159, `gateStateOf` v3-D211/D212, `canonicalOrder`
// v3-D261) — here on the scheduler's own due-review threshold and
// connection-weight multiplier, the two numbers §10's retention panel
// promises are "the SAME NUMBERS the scheduler uses".
//
// This asserts REFERENCE agreement (the module re-exports the engine's own
// binding), not merely that the two numbers happen to equal each other
// today — a value-only check would pass even on two independently
// hand-typed `0.15` literals.

import { describe, expect, it } from "vitest";
import { DEFAULT_CONN_WEIGHT, REVIEW_RISK_THRESHOLD as engineThreshold } from "@engine/scheduler.ts";
import { CONNECTION_WEIGHT, REVIEW_RISK_THRESHOLD } from "./retention.ts";

describe("retention.ts's own scheduler constants are the engine's, not a second declaration", () => {
  it("REVIEW_RISK_THRESHOLD is the engine's own REVIEW_RISK_THRESHOLD", () => {
    expect(REVIEW_RISK_THRESHOLD).toBe(engineThreshold);
  });

  it("CONNECTION_WEIGHT is the engine's own DEFAULT_CONN_WEIGHT", () => {
    expect(CONNECTION_WEIGHT).toBe(DEFAULT_CONN_WEIGHT);
  });
});
