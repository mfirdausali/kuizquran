<?php

namespace Database\Seeders;

use App\Models\QuestionOverride;
use Illuminate\Database\Seeder;

/**
 * ROADMAP Phase 7 (v2-D30 rolling scholar review, "resolve DATA-1... and null
 * glosses (incl. MS)") — the DATA-1 multi-word-unit `group` overrides and the
 * machine-sourced Bahasa Melayu `gloss` overrides for the early movements
 * (12:1-20, movements 1-2) that the rolling GATE-A review needs data-ready
 * before a human qari verifies them (v2-D59). Append-only, same as any other
 * `question_overrides` row: `editor_id` is null (no human editor account did
 * this) and `note` says exactly that, so the audit trail is honest about
 * provenance. Re-running this seeder is idempotent — it skips a key already
 * present at the same field, so `db:seed` is safe to run more than once.
 */
class Phase7OverrideSeeder extends Seeder
{
    private const SURAH = 12;
    private const MACHINE_NOTE_GROUP = 'DATA-1 multi-word unit (v1/docs/corpus-report.md review). '
        . 'Autonomous build (Phase 7) — pending qari confirmation this is a true grouping '
        . '(number compound / fixed expression) rather than an incidental word pair.';
    private const MACHINE_NOTE_MS = 'Machine-sourced Bahasa Melayu gloss (v2-D27). '
        . 'Autonomous build (Phase 7) — pending qari verification via the override editor.';

    public function run(): void
    {
        $now = (int) round(microtime(true) * 1000);

        $this->seedGroups($now);
        $this->seedMsGlosses($now);
    }

    private function seedGroups(int $now): void
    {
        $groups = json_decode(file_get_contents(__DIR__ . '/data/phase7_data1_groups.json'), true, flags: JSON_THROW_ON_ERROR);

        foreach ($groups as $g) {
            $exists = QuestionOverride::query()
                ->where('surah', self::SURAH)
                ->where('ayah', $g['ayah'])
                ->where('position', $g['anchor'])
                ->where('field', 'group')
                ->exists();
            if ($exists) {
                continue;
            }

            QuestionOverride::create([
                'surah' => self::SURAH,
                'ayah' => $g['ayah'],
                'position' => $g['anchor'],
                'question_type' => 'S1',
                'field' => 'group',
                'payload' => ['groupWith' => $g['group_with']],
                'editor_id' => null,
                'note' => self::MACHINE_NOTE_GROUP . " ({$g['phrase']} = \"{$g['gloss']}\")",
                'created_at' => $now,
            ]);
        }
    }

    private function seedMsGlosses(int $now): void
    {
        $rows = json_decode(file_get_contents(__DIR__ . '/data/phase7_ms_glosses.json'), true, flags: JSON_THROW_ON_ERROR);

        foreach ($rows as $r) {
            $exists = QuestionOverride::query()
                ->where('surah', self::SURAH)
                ->where('ayah', $r['ayah'])
                ->where('position', $r['position'])
                ->where('field', 'gloss')
                ->whereJsonContains('payload->lang', 'ms')
                ->exists();
            if ($exists) {
                continue;
            }

            QuestionOverride::create([
                'surah' => self::SURAH,
                'ayah' => $r['ayah'],
                'position' => $r['position'],
                'question_type' => 'S1',
                'field' => 'gloss',
                'payload' => ['lang' => 'ms', 'text' => $r['ms']],
                'editor_id' => null,
                'note' => self::MACHINE_NOTE_MS,
                'created_at' => $now,
            ]);
        }
    }
}
