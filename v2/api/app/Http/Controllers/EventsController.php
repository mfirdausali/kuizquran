<?php

namespace App\Http\Controllers;

use App\Models\Event;
use Illuminate\Http\Request;

/**
 * v2-D18: idempotent append-only event sync. POST /events accepts the same
 * WireEvent contract v1's worker used (mirrors v1/apps/worker/src/db.ts) —
 * user_id NEVER comes from the body, only from the Sanctum-authenticated
 * request. Idempotent by the client-stamped `id` (uuid): a re-sent batch (the
 * outbox retries after a dropped connection) is a no-op for ids already
 * stored, via insertOrIgnore on the primary key.
 */
class EventsController extends Controller
{
    /** Wire (camelCase) field → db (snake_case) column, for fields whose name
     *  differs from the wire shape. Everything else maps 1:1. */
    private const FIELD_MAP = [
        'to' => 'to_ayah',
        'stepKind' => 'step_kind',
        'testKind' => 'test_kind',
        'sentToReviews' => 'sent_to_reviews',
    ];

    private const NULLABLE_FIELDS = [
        'surah', 'ayah', 'rung', 'position', 'choice', 'correct', 'pretest',
        'to', 'stepKind', 'structured', 'latency', 'resume', 'testKind',
        'score', 'total', 'sentToReviews',
    ];

    public function store(Request $request): \Illuminate\Http\JsonResponse
    {
        $uid = $request->user()->id;
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
        $rows = array_map(function (array $e) use ($uid, $receivedAt) {
            $row = [
                'id' => $e['id'],
                'user_id' => $uid,
                'type' => $e['type'],
                'ts' => $e['ts'],
                'received_at' => $receivedAt,
            ];
            foreach (self::NULLABLE_FIELDS as $wireField) {
                $column = self::FIELD_MAP[$wireField] ?? $wireField;
                $row[$column] = $e[$wireField] ?? null;
            }

            return $row;
        }, $events);

        $accepted = Event::insertOrIgnore($rows);

        return response()->json([
            'accepted' => $accepted,
            'ignored' => count($rows) - $accepted,
        ]);
    }

    public function index(Request $request): \Illuminate\Http\JsonResponse
    {
        $uid = $request->user()->id;
        $rows = Event::where('user_id', $uid)
            ->orderBy('ts')
            ->orderBy('received_at')
            ->get();

        $events = $rows->map(function (Event $r) {
            $e = ['id' => $r->id, 'type' => $r->type, 'ts' => $r->ts];
            $set = function (string $wireField, $value) use (&$e) {
                if ($value !== null) {
                    $e[$wireField] = $value;
                }
            };
            $set('surah', $r->surah);
            $set('ayah', $r->ayah);
            $set('rung', $r->rung);
            $set('position', $r->position);
            $set('choice', $r->choice);
            $set('correct', $r->correct);
            $set('pretest', $r->pretest);
            $set('to', $r->to_ayah);
            $set('stepKind', $r->step_kind);
            $set('structured', $r->structured);
            $set('latency', $r->latency);
            $set('resume', $r->resume);
            $set('testKind', $r->test_kind);
            $set('score', $r->score);
            $set('total', $r->total);
            $set('sentToReviews', $r->sent_to_reviews);

            return $e;
        });

        return response()->json(['events' => $events]);
    }

    public function count(Request $request): \Illuminate\Http\JsonResponse
    {
        $uid = $request->user()->id;

        return response()->json(['count' => Event::where('user_id', $uid)->count()]);
    }
}
