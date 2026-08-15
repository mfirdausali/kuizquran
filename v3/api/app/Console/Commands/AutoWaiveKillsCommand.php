<?php

namespace App\Console\Commands;

use App\Flags\FlagService;
use Illuminate\Console\Command;

/**
 * Build-plan step 26 (M8): v3-D17's 72-hour audited auto-waive —
 * LAUNCH-CHECKLIST.md gate 9's "72h auto-waive, audited".
 *
 * `FlagService::autoWaiveDueKills()` existed and was unit-tested since the
 * flag plane shipped (its own docblock: "for the scheduler to call"), but
 * `routes/console.php` scheduled only the determinism nightly and the PDPA
 * purge — never this. A killed flag's admin banner therefore never
 * auto-cleared after 72h in a running app; only a test calling the service
 * method directly ever exercised it. This command is the missing caller, the
 * same thin-Artisan-wrapper shape `PurgeDueAccountsCommand` already
 * established for gate 19.
 *
 * An ack NEVER re-enables (#159), and neither does an auto-waive —
 * `FlagService::acknowledgeKill()` deliberately omits `enabled` from its
 * update. This command only ever clears the banner's "needs attention"
 * state; a killed flag stays off until an explicit, fully-ceremonied ramp.
 */
class AutoWaiveKillsCommand extends Command
{
    protected $signature = 'flags:auto-waive';

    protected $description = 'Audited 72-hour auto-waive of unacknowledged flag kills (v3-D17, LAUNCH-CHECKLIST gate 9)';

    public function handle(FlagService $flags): int
    {
        $nowMs = (int) round(microtime(true) * 1000);
        $waived = $flags->autoWaiveDueKills($nowMs);

        $this->line("flags:auto-waive — waived {$waived}");

        return self::SUCCESS;
    }
}
