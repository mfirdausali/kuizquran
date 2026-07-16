<?php

namespace Tests\Feature;

use App\Models\QuestionOverride;
use Database\Seeders\Phase7OverrideSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * ROADMAP Phase 7 (v2-D59): the DATA-1 `group` overrides + machine-sourced MS
 * `gloss` overrides for the early movements (12:1-20) get their data-readiness
 * work done here, via a seeder rather than the admin API (no human editor
 * account performed these edits — see the seeder's own doc comment).
 */
class Phase7OverrideSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeds_the_data1_group_overrides_and_they_surface_publicly(): void
    {
        $this->seed(Phase7OverrideSeeder::class);

        $groups = QuestionOverride::query()->where('field', 'group')->get();
        $this->assertCount(10, $groups);
        foreach ($groups as $g) {
            $this->assertNull($g->editor_id);
            $this->assertIsArray($g->payload['groupWith']);
        }

        // 12:4 position 8 (أَحَدَ) groups with position 9 (عَشَرَ) = "eleven".
        $eleven = $groups->firstWhere(fn ($g) => $g->ayah === 4 && $g->position === 8);
        $this->assertNotNull($eleven);
        $this->assertEquals([9], $eleven->payload['groupWith']);

        $list = $this->getJson('/api/overrides?surah=12')->assertOk()->json('overrides');
        $this->assertCount(267, $list); // 10 group + 257 MS gloss rows
    }

    public function test_seeds_all_257_ms_glosses_for_ayat_1_20(): void
    {
        $this->seed(Phase7OverrideSeeder::class);

        $msRows = QuestionOverride::query()
            ->where('field', 'gloss')
            ->get()
            ->filter(fn ($o) => ($o->payload['lang'] ?? null) === 'ms');

        $this->assertCount(257, $msRows);
        $this->assertTrue($msRows->every(fn ($o) => $o->ayah >= 1 && $o->ayah <= 20));
        $this->assertTrue($msRows->every(fn ($o) => is_string($o->payload['text']) && $o->payload['text'] !== ''));
    }

    public function test_re_seeding_is_idempotent(): void
    {
        $this->seed(Phase7OverrideSeeder::class);
        $this->seed(Phase7OverrideSeeder::class);

        $this->assertEquals(267, QuestionOverride::query()->count());
    }
}
