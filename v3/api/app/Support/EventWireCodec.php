<?php

namespace App\Support;

use App\Models\Event;

/**
 * Storage columns → the frozen DrillEvent wire shape (v3-D10). A pure
 * rename: nothing here computes, reinterprets, or defaults an engine value
 * (v3-D08 — Laravel stores the wire and hands it back; only the fold-runner
 * folds it).
 *
 * Extracted from `DeterminismCheckCommand::toWireEvent()` so `AtomCacheRebuilder`
 * — the second caller that needs to hand real events to a fold-runner script
 * — reads the SAME conversion rather than a second copy that could silently
 * drift from it (the wire freeze names itself "ONCE, complete" for exactly
 * this reason).
 */
class EventWireCodec
{
    /** @return array<string,mixed> */
    public static function toWire(Event $e): array
    {
        $wire = [
            'type' => $e->type,
            'ts' => (int) $e->ts,
            'surah' => (int) $e->surah,
            'ayah' => (int) $e->ayah,
            'rung' => $e->rung,
        ];
        $optional = [
            'id' => $e->uuid, 'position' => $e->position, 'correct' => $e->correct,
            'pretest' => $e->pretest, 'to' => $e->to_ayah, 'stepKind' => $e->step_kind,
            'structured' => $e->structured, 'latency' => $e->latency, 'resume' => $e->resume,
            'testKind' => $e->test_kind, 'score' => $e->score, 'total' => $e->total,
            'sentToReviews' => $e->sent_to_reviews, 'siteKey' => $e->site_key,
            'visitOrdinal' => $e->visit_ordinal, 'deviceId' => $e->device_id,
            'deviceSeq' => $e->device_seq, 'tz' => $e->tz, 'corpusHash' => $e->corpus_hash,
            'locale' => $e->locale, 'gradeClass' => $e->grade_class,
        ];
        foreach ($optional as $k => $v) {
            if ($v !== null) {
                $wire[$k] = $v;
            }
        }

        // `choice` is deliberately NOT forwarded. It holds tapped answer
        // text — Arabic for S2/S3 — and the fold never reads it
        // (rebuild.ts/applyEvent depend only on structural coordinates).
        // Sending it would push sacred text through a subprocess pipe and
        // into a stored JSON report for no benefit whatsoever.
        return $wire;
    }
}
