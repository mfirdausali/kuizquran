// v3-D09: "Canonical event order — (ts, deviceId, deviceSeq, uuid). Never
// `ts` alone — clocks skew and milliseconds tie. deviceSeq is per-device
// monotonic, assigned at emit." Why it matters (v3-D09's own words):
// `v2/src/db/eventLog.ts:113` drops the incoming `seq` on merge, so the
// client re-assigns a fresh LOCAL one and log order becomes arrival order.
// The server has the identical problem from the opposite direction: it
// receives events from however many devices in whatever order the network
// delivers them, and must fold them in ONE canonical order regardless.
//
// v3-D261: the comparator itself now lives in the ONE shared place both this
// package and `apps/web` can reach, `packages/engine/src/canonicalOrder.ts`
// (see that module's own header for why two independent, comment-synced
// copies was a real drift risk on this build's highest-severity signal).
// Re-exported here so every existing caller of this file
// (`test/canonicalOrder.test.ts`, `apps/web/lib/sync/merge.test.ts`,
// `fold.ts`) keeps working unchanged — proven arrival-order-invariant by
// `test/canonicalOrder.test.ts`.
export { canonicalOrder } from "../../../packages/engine/src/canonicalOrder.ts";
