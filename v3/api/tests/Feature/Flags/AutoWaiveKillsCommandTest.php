<?php

namespace Tests\Feature\Flags;

use App\Console\Commands\AutoWaiveKillsCommand;
use App\Models\Flag;
use App\Models\FlagRampAudit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Build-plan step 26 (M8) / LAUNCH-CHECKLIST.md gate 9's "72h auto-waive,
 * audited".
 *
 * `FlagService::autoWaiveDueKills()` has existed and been unit-tested since
 * the flag plane shipped (its own docblock: "for the scheduler to call"), but
 * `routes/console.php` only ever scheduled the determinism nightly and the
 * PDPA purge — never this. A killed flag's admin banner therefore never
 * auto-cleared in a running app; only a test calling the service method
 * directly ever exercised it. This command is the missing caller, the same
 * thin-Artisan-wrapper shape `PurgeDueAccountsCommand` already established.
 */
class AutoWaiveKillsCommandTest extends TestCase
{
    use RefreshDatabase;

    /** MUTATION: remove the command's call to autoWaiveDueKills() — must go RED. */
    public function test_it_auto_waives_a_kill_past_72_hours(): void
    {
        $key = 'social.study_groups';
        $killedAt = (int) now()->subHours(73)->valueOf();
        Flag::create(['key' => $key, 'enabled' => false, 'version' => 1, 'killed_at' => $killedAt]);

        $this->artisan(AutoWaiveKillsCommand::class)->assertSuccessful();

        $flag = Flag::where('key', $key)->first();
        $this->assertTrue($flag->ack_auto_waived, 'a kill 73h old must be auto-waived by the scheduled command');
        $this->assertFalse((bool) $flag->enabled, 'an auto-waive must never re-enable the flag (#159)');

        $audit = FlagRampAudit::where('flag_key', $key)->where('action', 'auto_waive')->first();
        $this->assertNotNull($audit, 'v3-D17: the auto-waive is AUDITED, even when triggered by the schedule');
    }

    /** A kill younger than 72h must not be touched by a run today. */
    public function test_it_leaves_a_recent_kill_untouched(): void
    {
        $key = 'notifications.email_digest';
        $killedAt = (int) now()->subHours(10)->valueOf();
        Flag::create(['key' => $key, 'enabled' => false, 'version' => 1, 'killed_at' => $killedAt]);

        $this->artisan(AutoWaiveKillsCommand::class)->assertSuccessful();

        $flag = Flag::where('key', $key)->first();
        $this->assertFalse($flag->ack_auto_waived, 'a 10h-old kill is not yet due');
    }

    /** Nothing due is a successful no-op, not a failure. */
    public function test_it_succeeds_with_nothing_due(): void
    {
        $this->artisan(AutoWaiveKillsCommand::class)->assertSuccessful();
    }
}
