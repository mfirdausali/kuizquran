<?php

namespace App\Http\Controllers;

use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Build-plan step 14: ingestion + pull, v3-D08's rule in force throughout —
 * this controller stores wire fields verbatim, it never computes a hash,
 * never resolves a rung, never re-implements engine logic. `user_id` NEVER
 * comes from the request body, only from the Sanctum-authenticated caller
 * (v2-D18's contract, carried forward).
 */
class EventsController extends Controller
{
    /** Wire (camelCase) field -> db (snake_case) column, for names that
     *  differ from the wire shape. Everything else maps 1:1. */
    private const FIELD_MAP = [
        'to' => 'to_ayah',
        'stepKind' => 'step_kind',
        'testKind' => 'test_kind',
        'sentToReviews' => 'sent_to_reviews',
        'siteKey' => 'site_key',
        'visitOrdinal' => 'visit_ordinal',
        'deviceId' => 'device_id',
        'deviceSeq' => 'device_seq',
        'corpusHash' => 'corpus_hash',
        'specSnapshot' => 'spec_snapshot',
        'gradeClass' => 'grade_class',
    ];

    /** Every DrillEvent field beyond {id, type, ts} — the full frozen wire
     *  shape (v3-D10), stored as-is, nullable when absent. */
    private const NULLABLE_FIELDS = [
        'surah', 'ayah', 'rung', 'position', 'choice', 'correct', 'pretest',
        'to', 'stepKind', 'structured', 'latency', 'resume', 'testKind',
        'score', 'total', 'sentToReviews',
        'siteKey', 'visitOrdinal', 'deviceId', 'deviceSeq', 'tz',
        'corpusHash', 'locale', 'specSnapshot', 'gradeClass',
    ];

    public function store(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $events = $request->input('events');
        if (! is_array($events)) {
            return response()->json(['error' => 'events[] required'], 400);
        }

        foreach ($events as $e) {
            if (! is_array($e) || ! isset($e['id']) || ! is_string($e['id']) || $e['id'] === '') {
                return response()->json(['error' => 'every event needs a string id'], 400);
            }
            if (! isset($e['type']) || ! isset($e['ts'])) {
                return response()->json(['error' => 'every event needs type and ts'], 400);
            }
        }

        if (count($events) === 0) {
            return response()->json(['accepted' => 0, 'ignored' => 0]);
        }

        $receivedAt = (int) round(microtime(true) * 1000);
        $rows = array_map(function (array $e) use ($userId, $receivedAt) {
            $row = [
                'user_id' => $userId,
                'uuid' => $e['id'],
                'type' => $e['type'],
                'ts' => $e['ts'],
                'received_at' => $receivedAt,
            ];
            foreach (self::NULLABLE_FIELDS as $wireField) {
                $column = self::FIELD_MAP[$wireField] ?? $wireField;
                $value = $e[$wireField] ?? null;
                $row[$column] = $column === 'spec_snapshot' && $value !== null ? json_encode($value) : $value;
            }

            return $row;
        }, $events);

        // "cap log-only-then-enforced" (M3 ships list) — log, never reject.
        $dailyCap = config('events.daily_cap');
        $countToday = Event::where('user_id', $userId)->where('received_at', '>=', $receivedAt - 86_400_000)->count();
        if ($countToday + count($rows) > $dailyCap) {
            Log::warning('events daily cap exceeded (log-only, not enforced)', [
                'user_id' => $userId,
                'count_today' => $countToday,
                'batch_size' => count($rows),
                'cap' => $dailyCap,
            ]);
        }

        $accepted = Event::insertOrIgnore($rows);

        return response()->json([
            'accepted' => $accepted,
            'ignored' => count($rows) - $accepted,
        ]);
    }

    /**
     * Cursored pull (build-plan step 14): `since` is the server ingest-
     * sequence (`id`), never `ts` — see the migration's own doc comment for
     * why this is what makes it late-arrival safe. Scoped to the
     * authenticated user only.
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $since = max(0, (int) $request->query('since', 0));
        $limit = min(
            config('events.pull_max_limit'),
            max(1, (int) $request->query('limit', config('events.pull_default_limit'))),
        );

        $rows = Event::where('user_id', $userId)
            ->where('id', '>', $since)
            ->orderBy('id')
            ->limit($limit)
            ->get();

        $events = $rows->map(fn (Event $r) => $this->toWire($r));
        $nextCursor = $rows->isNotEmpty() ? $rows->last()->id : $since;

        return response()->json([
            'events' => $events,
            'nextCursor' => $nextCursor,
            'hasMore' => $rows->count() === $limit,
        ]);
    }

    private function toWire(Event $r): array
    {
        $e = ['id' => $r->uuid, 'type' => $r->type, 'ts' => $r->ts];
        $set = function (string $wireField, $value) use (&$e) {
            if ($value !== null) {
                $e[$wireField] = $value;
            }
        };
        foreach (self::NULLABLE_FIELDS as $wireField) {
            $column = self::FIELD_MAP[$wireField] ?? $wireField;
            $set($wireField, $r->{$column});
        }

        return $e;
    }
}
