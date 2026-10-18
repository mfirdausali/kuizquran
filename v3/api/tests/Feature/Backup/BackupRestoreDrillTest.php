<?php

namespace Tests\Feature\Backup;

use App\Console\Commands\BackupRestoreDrillCommand;
use App\Models\Event;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use ReflectionMethod;
use Tests\TestCase;

/**
 * BUILD-PLAN step 30 / M10 — `backup:restore-drill`'s PURGE-AWARE property
 * (v3-D123).
 *
 * Until this fix, the drill's "purge" step called `$doomed->delete()`
 * directly and hand-wrote a JSON file shaped like a ledger row
 * (`{user_id, purged_at, reason}`) — sharing no code, no column names, and no
 * transaction with the REAL PDPA purge path (`PurgeDueAccountsCommand` →
 * `AccountDeletionRequest` → `PurgeLedgerEntry`, build-plan step 23, shipped
 * hours after this drill was first written, `93ce02a` following `75ac0bb`).
 * The drill's own docblock, `PurgeLedgerEntry`'s own docblock, and
 * `AccountDeletionTest`'s own docblock all claimed this drill exercised or
 * reconciled against the real thing — all three were false. `make test`
 * never caught it because no test of `backup:restore-drill` existed at all,
 * in either direction, until this file.
 *
 * This suite runs the REAL command end to end — safe inside
 * `RefreshDatabase`: the drill's own dump/wipe/restore all execute inside
 * this test's transaction and are rolled back when the test ends, the same
 * as any other write in this suite.
 */
class BackupRestoreDrillTest extends TestCase
{
    use RefreshDatabase;

    /** The drill must still pass end to end — this command had zero test
     *  coverage before this file; this is the first proof it runs clean. */
    public function test_the_drill_passes_end_to_end_against_sqlite(): void
    {
        $dir = storage_path('app/backup-drill-test-'.bin2hex(random_bytes(4)));

        $this->artisan('backup:restore-drill', ['--dir' => $dir])
            ->assertSuccessful();
    }

    /** Load-bearing: the captured ledger must carry the REAL
     *  `PurgeLedgerEntry` shape (`id`, `purged_at_ms`) — not the fabricated
     *  shape (`purged_at`, no `id`) the unfixed drill wrote by hand. Against
     *  the unfixed source these keys are simply absent (RED); against the
     *  fix they are present because the row was captured from the real
     *  model's own `create()` + `toArray()`, not authored by this command. */
    public function test_the_captured_ledger_carries_the_real_model_shape_not_a_fabrication(): void
    {
        $dir = storage_path('app/backup-drill-test-'.bin2hex(random_bytes(4)));

        $this->artisan('backup:restore-drill', ['--dir' => $dir, '--keep' => true])
            ->assertSuccessful();

        $ledgerPath = $dir.'/purge-ledger.json';
        $this->assertFileExists($ledgerPath, 'the drill must persist the captured ledger when --keep is passed');

        $rows = json_decode(file_get_contents($ledgerPath), true);
        $this->assertNotEmpty($rows, "the captured ledger must contain the doomed subject's real purge_ledger row");
        $this->assertArrayHasKey('id', $rows[0], 'a fabricated ledger entry has no primary key — this one must, because it is a real Eloquent row');
        $this->assertArrayHasKey(
            'purged_at_ms',
            $rows[0],
            'the real PurgeLedgerEntry column is purged_at_ms; the old fabricated ledger used purged_at instead',
        );
        $this->assertSame('pdpa_delete', $rows[0]['reason']);
    }

    /** Load-bearing: the drill's own console output must show the REAL
     *  `pdpa:purge-due` command actually ran (it prints its own "purged N,
     *  skipped N" line) — never true against the unfixed drill, which never
     *  called it at all. */
    public function test_the_drill_actually_invokes_the_real_purge_command(): void
    {
        $dir = storage_path('app/backup-drill-test-'.bin2hex(random_bytes(4)));

        $this->artisan('backup:restore-drill', ['--dir' => $dir])
            ->expectsOutputToContain('pdpa:purge-due — purged 1, skipped 0')
            ->assertSuccessful();
    }

    /**
     * Load-bearing (v3-D326): `EVENT_WIRE_COLUMNS` must cover every column
     * the engine's own fold actually reads when grading a tap
     * (`packages/engine/src/rebuild.ts#applyEvent()`: `rung`, `correct`,
     * `pretest`, `structured`, `step_kind`, and `received_at` via
     * `effectiveTs()`) — not just the columns the drill happened to list.
     * Before this fix the checksum never varied with any of them, so a
     * restore that silently flipped a learner's own pass/fail, reinterpreted
     * which rung they were graded on, or dropped the pretest/structured/
     * junction-step flag would still report "wire checksum identical — a
     * re-fold produces the same atoms", which is exactly the silent
     * invariant-#2 break this command exists to catch.
     *
     * This exercises the private `eventChecksum()` method directly via
     * reflection, not a full dump/encrypt/wipe/restore round trip: the
     * checksum's own sensitivity to each column is what is under test here,
     * since a corrupted restore is only ever observable as *some* column
     * value differing from what was dumped. The full round trip is already
     * covered end to end by `test_the_drill_passes_end_to_end_against_sqlite`
     * above.
     */
    public function test_the_event_checksum_is_sensitive_to_every_fold_input_column(): void
    {
        $userId = User::factory()->create()->id;

        $base = [
            'user_id' => $userId,
            'uuid' => (string) Str::uuid(),
            'type' => 'gate_result',
            'ts' => 1_700_000_000_000,
            'surah' => 112,
            'ayah' => 1,
            'rung' => 'gate',
            'correct' => true,
            'pretest' => false,
            'structured' => true,
            'step_kind' => null,
            'device_id' => 'drill-device',
            'device_seq' => 1,
            'received_at' => 1_700_000_000_500,
        ];

        $command = $this->app->make(BackupRestoreDrillCommand::class);
        $checksum = new ReflectionMethod($command, 'eventChecksum');
        $checksum->setAccessible(true);

        $row = fn (array $overrides) => array_merge($base, $overrides);

        Event::query()->delete();
        Event::create($row([]));
        $baseline = $checksum->invoke($command);

        $mutations = [
            'rung' => 'full',
            'correct' => false,
            'pretest' => true,
            'structured' => false,
            'step_kind' => 'junction',
            'received_at' => 1_700_000_500_000,
        ];

        foreach ($mutations as $field => $mutatedValue) {
            Event::query()->delete();
            Event::create($row([$field => $mutatedValue]));
            $mutatedChecksum = $checksum->invoke($command);

            $this->assertNotSame(
                $baseline,
                $mutatedChecksum,
                "eventChecksum() did not change when `{$field}` changed — a restore ".
                'that silently corrupts this fold-input column would go undetected',
            );
        }
    }
}
