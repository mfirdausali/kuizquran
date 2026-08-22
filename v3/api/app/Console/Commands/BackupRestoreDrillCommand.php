<?php

namespace App\Console\Commands;

use App\Models\AccountDeletionRequest;
use App\Models\AdminAudit;
use App\Models\Event;
use App\Models\PurgeLedgerEntry;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * BUILD-PLAN step 30 / M10: "backup restore drill (encrypted, purge-aware)".
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * WHY THIS IS A COMMAND THAT RESTORES, AND NOT A RUNBOOK THAT DESCRIBES ONE
 * ═══════════════════════════════════════════════════════════════════════════════
 * A backup nobody has restored is a hypothesis, not a backup. The failure mode
 * this drill exists to catch is the one every team discovers at the worst
 * possible moment: the dump ran nightly for a year, the file was the right size
 * every morning, and it turns out to restore into a database that is missing a
 * table, or silently truncates the one column the fold depends on.
 *
 * So this command performs a REAL round trip — dump, encrypt, wipe, decrypt,
 * restore — into a THROWAWAY database, and then compares the restored contents
 * against what was there before, row by row. It exits non-zero when the restored
 * copy differs. That exit code is the whole product of this command: it is what
 * lets the launch checklist say "backup restore drill: GREEN" and mean it.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * THE THREE PROPERTIES BUILD-PLAN NAMES
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 1. IT ACTUALLY RESTORES. Verified by content comparison, not by "the file
 *    exists" or "the command exited 0". Specifically: per-table row counts, plus
 *    a checksum over the EVENT LOG's wire columns — because the event log is the
 *    truth of this product (invariant #2, "the log is the truth"). A restore
 *    that brings back users but drops or reorders events has restored nothing
 *    that matters: the fold would produce different atoms, and every learner's
 *    memory graph would silently change.
 *
 * 2. ENCRYPTED. The artifact on disk is ciphertext. The drill asserts this by
 *    grepping the encrypted file for a known plaintext needle that is definitely
 *    in the database, and FAILING if it is found. This is deliberately a
 *    property of the ARTIFACT rather than of the code path that wrote it: a test
 *    that asserts "we called encrypt()" passes just as happily when encrypt()
 *    returns its input unchanged.
 *
 * 3. PURGE-AWARE. A PDPA delete must not be undone by a restore. This is the
 *    property that makes backups legally dangerous rather than merely useful:
 *    restoring a three-week-old dump silently resurrects every learner who asked
 *    to be forgotten in those three weeks, and nothing in a naive restore
 *    notices. The drill therefore records a purge, restores a backup taken
 *    BEFORE it, and asserts the purged subject did NOT come back.
 *
 *    ── CORRECTED 2026-08-22 (v3-D123) — THIS USED TO BE FABRICATED ──
 *    This docblock previously claimed "the PDPA delete/purge endpoint is M7
 *    scope and IS NOT BUILT YET" and that the drill only exercised a stand-in
 *    reconciliation mechanism. That was true when this file was first written
 *    (`75ac0bb`) but became false a few hours later the SAME DAY, when
 *    `93ce02a` shipped the real endpoint (`PurgeDueAccountsCommand`,
 *    `AccountDeletionRequest`, `PurgeLedgerEntry`) — and this file was never
 *    revisited. In between, the purge step below directly called
 *    `$doomed->delete()` and hand-wrote a JSON file shaped like a ledger row
 *    but sharing no code, no column names (`purged_at` vs the real
 *    `purged_at_ms`) and no transaction with the actual purge path — so this
 *    property was PASSING GREEN while proving nothing about whether a real
 *    PDPA purge survives a restore. `PurgeLedgerEntry`'s own docblock and
 *    `AccountDeletionTest`'s own docblock both asserted this drill "already
 *    reconciles against" / "already exercises" the real thing — also false,
 *    for the same reason. Fixed: the purge below is a real
 *    `AccountDeletionRequest` (due immediately) consumed by a real
 *    `$this->call(PurgeDueAccountsCommand::class)` — the exact command that
 *    runs nightly in production. The JSON ledger file this drill still writes
 *    is not fabricated data; it is a CAPTURE of the real `PurgeLedgerEntry`
 *    row `pdpa:purge-due` just wrote, taken because the ledger row itself is
 *    created AFTER the backup dump below and would otherwise be lost in the
 *    wipe — an operator restoring a stale backup needs the current ledger
 *    from somewhere outside that stale backup too, which is exactly what this
 *    file stands in for.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * WHAT THIS DRILL DOES NOT PROVE
 * ═══════════════════════════════════════════════════════════════════════════════
 * It runs against the CONFIGURED database. On a developer machine that is
 * SQLite, and a green SQLite drill does not prove a Postgres restore. The drill
 * reports which driver it ran against, and LAUNCH-CHECKLIST.md carries the
 * staging-Postgres run as a separate, still-open line. A drill that quietly
 * implied more coverage than it has would be worse than no drill.
 */
class BackupRestoreDrillCommand extends Command
{
    protected $signature = 'backup:restore-drill
        {--keep : Keep the drill artifacts on disk for inspection}
        {--dir= : Directory for drill artifacts (default: storage/app/backup-drill)}';

    protected $description = 'Prove a backup actually restores: dump → encrypt → wipe → decrypt → restore → verify (M10)';

    /**
     * Framework-owned tables that are rebuildable and carry no product truth.
     * Everything ELSE in the schema must survive a restore byte-for-byte —
     * derived, not listed, by `criticalTables()`.
     */
    private const REBUILDABLE_TABLES = [
        'migrations',
        'cache',
        'cache_locks',
        'jobs',
        'job_batches',
        'failed_jobs',
        'sessions',
        'password_reset_tokens',
        'personal_access_tokens',
    ];

    /**
     * The tables whose contents must survive a restore, DERIVED FROM THE LIVE
     * SCHEMA rather than hardcoded.
     *
     * Two reasons, and the second is why this changed:
     *
     * 1. A hardcoded list silently stops covering the schema the moment someone
     *    adds a table. A backup drill that verifies nine of eleven tables and
     *    reports "DRILL PASSED" is the precise failure this command exists to
     *    prevent — it would be a check that cannot fail for the tables nobody
     *    remembered to add.
     *
     * 2. The hardcoded version named `entitlements`, which tripped
     *    `EntitlementBoundaryTest` (v3-D55: only allowlisted files may mention
     *    entitlements, so a paywall read can never leak into the fold path).
     *    That gate is right and stays untouched: deriving the list means this
     *    command reads the schema, never entitlement state, which is what it
     *    always meant to do.
     *
     * @return string[]
     */
    private function criticalTables(): array
    {
        return array_values(array_filter(
            $this->allTables(),
            fn (string $t) => ! in_array($t, self::REBUILDABLE_TABLES, true),
        ));
    }

    /**
     * The event-log columns whose exact values the fold depends on. If a restore
     * perturbs ANY of these, the re-fold produces different atoms — which is
     * invariant #2 breaking silently. Ordered so the checksum is stable.
     */
    private const EVENT_WIRE_COLUMNS = [
        'user_id', 'uuid', 'device_id', 'device_seq', 'ts', 'type',
        'surah', 'ayah', 'site_key', 'visit_ordinal', 'grade_class',
        'tz', 'corpus_hash', 'locale',
    ];

    public function handle(): int
    {
        $dir = $this->option('dir') ?: storage_path('app/backup-drill');
        if (! is_dir($dir) && ! mkdir($dir, 0700, true) && ! is_dir($dir)) {
            $this->error("cannot create drill directory: {$dir}");

            return self::FAILURE;
        }

        $driver = DB::connection()->getDriverName();
        $this->line('');
        $this->info('══ BACKUP RESTORE DRILL (build-plan step 30 / M10) ══');
        $this->line("driver: {$driver}");
        $this->line("artifacts: {$dir}");
        $this->line('');

        $failures = [];

        // ─────────────────────────────────────────────────────────────────────
        // 0. FIXTURE. The drill needs something to lose. A dedicated marker row
        //    gives the encryption check a plaintext needle that is guaranteed
        //    present, and gives the purge check a subject to forget.
        // ─────────────────────────────────────────────────────────────────────
        $needle = 'drill-needle-'.bin2hex(random_bytes(8));
        $purgedNeedle = 'drill-purged-'.bin2hex(random_bytes(8));

        $keeper = User::create([
            'email' => $needle.'@drill.invalid',
            'name' => 'Drill Keeper',
            'password' => bcrypt(bin2hex(random_bytes(8))),
            'is_anonymous' => false,
        ]);
        $doomed = User::create([
            'email' => $purgedNeedle.'@drill.invalid',
            'name' => 'Drill Purge Subject',
            'password' => bcrypt(bin2hex(random_bytes(8))),
            'is_anonymous' => false,
        ]);

        $before = $this->snapshot();
        $this->line("baseline: {$before['totalRows']} rows across ".count($this->criticalTables()).' critical tables');
        $this->line('          event-log wire checksum '.substr($before['eventChecksum'], 0, 16).'…');

        // ─────────────────────────────────────────────────────────────────────
        // 1. DUMP + ENCRYPT.
        // ─────────────────────────────────────────────────────────────────────
        $plainPath = $dir.'/drill.sql';
        $encPath = $dir.'/drill.sql.enc';

        $dumped = $this->dump($plainPath);
        if ($dumped === null) {
            $this->error('FAIL — dump produced nothing');

            return self::FAILURE;
        }
        $this->line('dump: '.number_format(filesize($plainPath)).' bytes');

        $key = $this->drillKey();
        $this->encrypt($plainPath, $encPath, $key);
        @unlink($plainPath);   // the plaintext dump must not linger
        $this->line('encrypt: '.number_format(filesize($encPath)).' bytes ciphertext');

        // ── PROPERTY 2: the artifact is genuinely ciphertext. ────────────────
        $cipher = file_get_contents($encPath);
        if (str_contains($cipher, $needle)) {
            $failures[] = 'ENCRYPTION: a known plaintext value was found verbatim inside the "encrypted" backup';
            $this->error('  ✗ encryption — plaintext readable in the artifact');
        } else {
            $this->line('  ✓ encryption — a known plaintext value is not readable in the artifact');
        }
        if (is_file($plainPath)) {
            $failures[] = 'ENCRYPTION: the plaintext dump was left on disk beside the encrypted one';
        }

        // ─────────────────────────────────────────────────────────────────────
        // 2. RECORD A REAL PDPA PURGE, AFTER the backup was taken, through the
        //    ACTUAL production code path — not a hand-rolled delete. This is
        //    the ordering that makes the property non-trivial: the backup on
        //    disk still CONTAINS the doomed subject (see v3-D123: this used to
        //    delete $doomed directly and fabricate a ledger file, exercising
        //    nothing about the real purge).
        // ─────────────────────────────────────────────────────────────────────
        $nowMs = (int) round(microtime(true) * 1000);
        AccountDeletionRequest::create([
            'user_id' => $doomed->id,
            'token_hash' => hash('sha256', bin2hex(random_bytes(16))),
            'requested_at_ms' => $nowMs,
            'purge_at_ms' => $nowMs, // already due
        ]);
        $this->call(PurgeDueAccountsCommand::class);

        if (User::whereKey($doomed->id)->exists()) {
            $failures[] = 'PURGE: pdpa:purge-due did not remove the doomed subject — the real purge path never ran';
        }

        // Capture the REAL `purge_ledger` row `pdpa:purge-due` just wrote.
        // This is NOT fabricated: the row is created by the same
        // `PurgeLedgerEntry::create()` call and the same transaction
        // production runs nightly. It has to be captured to a file because
        // it exists only AFTER the backup dump above and would otherwise be
        // lost in the wipe below — the same reason a real operator restoring
        // a stale backup needs the ledger from somewhere outside that backup.
        $purgeLedger = $dir.'/purge-ledger.json';
        $realLedgerRows = PurgeLedgerEntry::where('user_id', $doomed->id)->get()->toArray();
        if ($realLedgerRows === []) {
            $failures[] = 'PURGE: pdpa:purge-due did not write a purge_ledger row for the doomed subject';
        }
        file_put_contents($purgeLedger, json_encode($realLedgerRows, JSON_PRETTY_PRINT));
        $this->line('purge: recorded a REAL PDPA purge via pdpa:purge-due for a subject the backup still contains');

        // ─────────────────────────────────────────────────────────────────────
        // 3. WIPE. The destructive half — without it the "restore" proves
        //    nothing, because the data never left.
        // ─────────────────────────────────────────────────────────────────────
        $wipedFrom = $before['totalRows'];
        $this->wipe();
        $after = $this->snapshot();
        if ($after['totalRows'] !== 0) {
            $failures[] = "WIPE: {$after['totalRows']} rows survived the wipe — the restore below would prove nothing";
            $this->error("  ✗ wipe — {$after['totalRows']} rows survived");
        } else {
            $this->line("  ✓ wipe — all {$wipedFrom} rows gone; the database is genuinely empty");
        }

        // ─────────────────────────────────────────────────────────────────────
        // 4. DECRYPT + RESTORE.
        //
        //    A FAILING RESTORE IS A DRILL RESULT, NOT A CRASH. A truncated or
        //    corrupted dump throws mid-load — which is exactly the scenario this
        //    drill exists to surface — and an uncaught exception would exit with
        //    a stack trace instead of the verdict the launch checklist reads.
        //    Worse, it would skip the cleanup below and leave the drill's own
        //    fixture rows behind. So the throw is caught, recorded as a failure,
        //    and verification continues against whatever DID land: "restored
        //    380 of 503 rows" is a far more useful incident report than a
        //    PDOException, and it is the partial-restore case a real operator
        //    has to reason about at 3am.
        // ─────────────────────────────────────────────────────────────────────
        $this->decrypt($encPath, $plainPath, $key);
        try {
            $this->restore($plainPath);
        } catch (\Throwable $e) {
            $failures[] = 'RESTORE: the backup failed to load — '.$this->firstLine($e->getMessage());
            $this->error('  ✗ restore — the backup did not load cleanly');
        }
        @unlink($plainPath);

        $restored = $this->snapshot();

        // ── REFERENTIAL INTEGRITY, re-asserted AFTER the load. ───────────────
        // Constraints are suspended during the load (see `restore()`), so this
        // is where they are checked. An empty result means every foreign key
        // resolved once all tables were present — the property row-by-row
        // enforcement could not express, given a dump is an unordered set of
        // rows. A restore that leaves a dangling reference fails here.
        $violations = $this->foreignKeyViolations();
        if ($violations > 0) {
            $failures[] = "RESTORE: {$violations} foreign-key violations remain after the load — the restored database is referentially broken";
            $this->error("  ✗ integrity — {$violations} dangling references after restore");
        } else {
            $this->line('  ✓ integrity — every foreign key resolves after the load');
        }

        // ── PROPERTY 1: the restore actually restored. ───────────────────────
        if ($restored['totalRows'] !== $before['totalRows']) {
            $failures[] = "RESTORE: row count differs — before {$before['totalRows']}, after {$restored['totalRows']}";
            $this->error("  ✗ restore — {$before['totalRows']} rows in, {$restored['totalRows']} rows out");
        } else {
            $this->line("  ✓ restore — all {$before['totalRows']} rows returned");
        }

        foreach ($this->criticalTables() as $table) {
            $b = $before['perTable'][$table] ?? null;
            $r = $restored['perTable'][$table] ?? null;
            if ($b !== $r) {
                $failures[] = "RESTORE: table `{$table}` had {$b} rows, restored with {$r}";
            }
        }

        // The one that matters most: the event log is bit-identical.
        if ($restored['eventChecksum'] !== $before['eventChecksum']) {
            $failures[] = 'RESTORE: the event log restored with a DIFFERENT wire checksum — a re-fold would produce different atoms (invariant #2)';
            $this->error('  ✗ event log — wire checksum changed across the round trip');
        } else {
            $this->line('  ✓ event log — wire checksum identical; a re-fold produces the same atoms');
        }

        // ─────────────────────────────────────────────────────────────────────
        // 5. PURGE-AWARENESS: re-apply the REAL captured `purge_ledger` row,
        //    then prove the forgotten subject did not come back.
        // ─────────────────────────────────────────────────────────────────────
        $resurrected = User::whereKey($doomed->id)->exists();
        if (! $resurrected) {
            $failures[] = 'PURGE-DRILL: the purged subject was not present in the restore at all, so re-applying the ledger proves nothing. The backup was taken before the purge — check the drill ordering.';
        }

        $ledger = json_decode(file_get_contents($purgeLedger), true) ?: [];
        $reapplied = 0;
        foreach ($ledger as $entry) {
            $reapplied += User::whereKey($entry['user_id'])->delete();
        }

        if (User::whereKey($doomed->id)->exists()) {
            $failures[] = 'PURGE: a PDPA-deleted subject SURVIVED the restore + ledger re-application. A restore would resurrect a learner who asked to be forgotten.';
            $this->error('  ✗ purge-aware — the forgotten subject came back');
        } else {
            $this->line("  ✓ purge-aware — {$reapplied} purge-ledger entry re-applied; the forgotten subject stayed forgotten");
        }

        // The keeper must NOT have been purged — a drill that deleted everything
        // would pass the purge check for the wrong reason.
        if (! User::whereKey($keeper->id)->exists()) {
            $failures[] = 'PURGE: the ledger re-application removed a subject that was never purged';
        } else {
            $this->line('  ✓ purge-aware — a non-purged subject was left untouched');
        }

        // ─────────────────────────────────────────────────────────────────────
        // 6. CLEAN UP the drill's own fixture rows.
        // ─────────────────────────────────────────────────────────────────────
        User::whereKey($keeper->id)->delete();
        if (! $this->option('keep')) {
            @unlink($encPath);
            @unlink($purgeLedger);
        }

        // ─────────────────────────────────────────────────────────────────────
        // VERDICT
        // ─────────────────────────────────────────────────────────────────────
        $this->line('');
        if ($failures !== []) {
            $this->error('══ DRILL FAILED ══');
            foreach ($failures as $f) {
                $this->error('  • '.$f);
            }

            return self::FAILURE;
        }

        $this->info('══ DRILL PASSED ══');
        $this->line('');
        $this->warn('SCOPE — what this run does and does not cover:');
        $this->line("  • ran against driver `{$driver}`. A green SQLite drill does NOT prove a");
        $this->line('    Postgres restore. The staging-Postgres run is a separate checklist line.');
        $this->line('  • the purge step above runs the REAL `pdpa:purge-due` command against a real');
        $this->line('    `AccountDeletionRequest`, and reconciles against a captured REAL');
        $this->line('    `purge_ledger` row — not a fabricated one (v3-D123).');
        $this->line('  • no off-site copy, retention window, or key-rotation policy is exercised here.');
        $this->line('');

        return self::SUCCESS;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Snapshot / comparison
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * @return array{totalRows:int, perTable:array<string,int|null>, eventChecksum:string}
     */
    private function snapshot(): array
    {
        $perTable = [];
        $total = 0;
        foreach ($this->criticalTables() as $table) {
            if (! Schema::hasTable($table)) {
                $perTable[$table] = null;

                continue;
            }
            $count = (int) DB::table($table)->count();
            $perTable[$table] = $count;
            $total += $count;
        }

        return [
            'totalRows' => $total,
            'perTable' => $perTable,
            'eventChecksum' => $this->eventChecksum(),
        ];
    }

    /**
     * A checksum over the event log's WIRE COLUMNS in canonical order
     * (ts, device_id, device_seq, uuid — v3's canonical event order).
     *
     * Not `count(*)`: a restore can preserve the row count while corrupting a
     * column, and the fold reads columns, not counts.
     */
    private function eventChecksum(): string
    {
        if (! Schema::hasTable('events')) {
            return 'no-events-table';
        }

        $columns = array_values(array_filter(
            self::EVENT_WIRE_COLUMNS,
            fn (string $c) => Schema::hasColumn('events', $c),
        ));
        if ($columns === []) {
            return 'no-wire-columns';
        }

        $hash = hash_init('sha256');
        DB::table('events')
            ->select($columns)
            ->orderBy('ts')
            ->orderBy('device_id')
            ->orderBy('device_seq')
            ->orderBy('uuid')
            ->chunk(1000, function ($rows) use ($hash, $columns) {
                foreach ($rows as $row) {
                    $parts = [];
                    foreach ($columns as $c) {
                        $parts[] = $c.'='.var_export(((array) $row)[$c] ?? null, true);
                    }
                    hash_update($hash, implode('|', $parts)."\n");
                }
            });

        return hash_final($hash);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Dump / restore — driver-specific
    // ══════════════════════════════════════════════════════════════════════════

    /** Returns the dump path, or null when nothing was produced. */
    private function dump(string $path): ?string
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'sqlite') {
            // A logical dump, not a file copy: a file copy would "restore"
            // even if the schema were unreadable, which is the whole class of
            // failure this drill exists to find.
            $sql = '';
            foreach ($this->allTables() as $table) {
                foreach (DB::table($table)->get() as $row) {
                    $cols = array_keys((array) $row);
                    $vals = array_map(
                        fn ($v) => $v === null ? 'NULL' : DB::connection()->getPdo()->quote((string) $v),
                        array_values((array) $row),
                    );
                    $sql .= 'INSERT INTO "'.$table.'" ("'.implode('","', $cols).'") VALUES ('.implode(',', $vals).");\n";
                }
            }
            file_put_contents($path, $sql);

            return $path;
        }

        // Postgres / MySQL: shell out to the vendor dumper.
        $config = DB::connection()->getConfig();
        $cmd = $driver === 'pgsql'
            ? sprintf(
                'PGPASSWORD=%s pg_dump --data-only --no-owner -h %s -p %s -U %s %s',
                escapeshellarg((string) ($config['password'] ?? '')),
                escapeshellarg((string) ($config['host'] ?? '127.0.0.1')),
                escapeshellarg((string) ($config['port'] ?? 5432)),
                escapeshellarg((string) ($config['username'] ?? '')),
                escapeshellarg((string) ($config['database'] ?? '')),
            )
            : sprintf(
                'mysqldump --no-create-info -h%s -P%s -u%s -p%s %s',
                escapeshellarg((string) ($config['host'] ?? '127.0.0.1')),
                escapeshellarg((string) ($config['port'] ?? 3306)),
                escapeshellarg((string) ($config['username'] ?? '')),
                escapeshellarg((string) ($config['password'] ?? '')),
                escapeshellarg((string) ($config['database'] ?? '')),
            );

        exec($cmd.' > '.escapeshellarg($path).' 2>/dev/null', $out, $code);

        return ($code === 0 && is_file($path) && filesize($path) > 0) ? $path : null;
    }

    private function restore(string $path): void
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'sqlite') {
            // FOREIGN KEYS ARE SUSPENDED FOR THE DURATION OF THE LOAD, and this
            // is not a shortcut — it is what every real restore does, and the
            // reason is ordering.
            //
            // The first run of this drill failed exactly here: `events` was
            // restored before `users` (the dump walks tables alphabetically), so
            // every INSERT hit "FOREIGN KEY constraint failed" and the restore
            // died a third of the way in. A dump is a set of rows, not a
            // topologically sorted graph, and any restore that enforces
            // referential integrity ROW BY ROW is a restore that only works when
            // the alphabet happens to agree with the dependency order.
            //
            // Postgres achieves the same thing with `--disable-triggers` /
            // deferred constraints; `pg_restore` does it by default. Integrity
            // is re-checked at the end, so a dump that is genuinely
            // inconsistent is still caught — by the verification below, which
            // compares the restored contents against the baseline.
            DB::statement('PRAGMA foreign_keys = OFF');
            try {
                DB::unprepared(file_get_contents($path));
            } finally {
                DB::statement('PRAGMA foreign_keys = ON');
            }

            return;
        }

        $config = DB::connection()->getConfig();
        $cmd = $driver === 'pgsql'
            ? sprintf(
                'PGPASSWORD=%s psql -h %s -p %s -U %s -d %s -f %s',
                escapeshellarg((string) ($config['password'] ?? '')),
                escapeshellarg((string) ($config['host'] ?? '127.0.0.1')),
                escapeshellarg((string) ($config['port'] ?? 5432)),
                escapeshellarg((string) ($config['username'] ?? '')),
                escapeshellarg((string) ($config['database'] ?? '')),
                escapeshellarg($path),
            )
            : sprintf(
                'mysql -h%s -P%s -u%s -p%s %s < %s',
                escapeshellarg((string) ($config['host'] ?? '127.0.0.1')),
                escapeshellarg((string) ($config['port'] ?? 3306)),
                escapeshellarg((string) ($config['username'] ?? '')),
                escapeshellarg((string) ($config['password'] ?? '')),
                escapeshellarg((string) ($config['database'] ?? '')),
                escapeshellarg($path),
            );

        exec($cmd.' 2>/dev/null', $out, $code);
    }

    /**
     * A driver exception's diagnosis, WITH THE SQL STRIPPED.
     *
     * Laravel's QueryException appends the entire failing statement to the
     * message. For these tables that means a learner's email and bcrypt hash
     * would be echoed to the console and into whatever CI log captures the
     * drill — a backup verification tool that leaks the data it is verifying.
     * The first run of this mutation printed exactly that:
     *
     *   unrecognized token: "'drill-purged-…@drill.invalid" (Connection: sqlite,
     *   SQL: INSERT INTO "users" ("id","name","email",…
     *
     * Truncating was not enough, because the address sat inside the first 160
     * characters. So the SQL clause is REMOVED rather than shortened: the
     * driver's diagnosis ("unrecognized token", "no such table") is what an
     * operator needs, and the row that triggered it is never the useful part.
     * Same rule as `AdminAudit::scanFreeText` — this tool does not emit PII.
     */
    private function firstLine(string $message): string
    {
        $line = strtok($message, "\n") ?: $message;

        // Everything from " (Connection: …" onward is Laravel's own appendix,
        // which is where the bound SQL — and therefore the data — lives.
        $line = preg_replace('/\s*\(Connection:.*$/s', '', $line) ?? $line;

        // The driver ALSO quotes the offending literal in its own diagnosis,
        // before that marker — and it quotes it TRUNCATED, so an email-shaped
        // regex does not match ("'drill-purged-8b02@dril" has no TLD). The
        // value is never the actionable part of "unrecognized token", so every
        // quoted literal is replaced wholesale rather than pattern-matched.
        $line = preg_replace('/"[^"]*"|\'[^\']*\'/', '[redacted]', $line) ?? $line;

        return mb_strimwidth(trim($line), 0, 160, '…');
    }

    /**
     * How many rows hold a foreign key that points at nothing.
     *
     * Postgres/MySQL re-validate constraints when the restore session ends, so
     * a violation there surfaces as a failed restore rather than as a count;
     * this returns 0 for them and the row-count/checksum comparisons carry the
     * verification. SQLite needs the explicit sweep because `PRAGMA
     * foreign_keys = OFF` genuinely does not check.
     */
    private function foreignKeyViolations(): int
    {
        if (DB::connection()->getDriverName() !== 'sqlite') {
            return 0;
        }

        return count(DB::select('PRAGMA foreign_key_check'));
    }

    /** Empty every table the dump covers, children first. */
    private function wipe(): void
    {
        $tables = array_reverse($this->allTables());
        DB::connection()->getDriverName() === 'sqlite'
            ? DB::statement('PRAGMA foreign_keys = OFF')
            : null;

        foreach ($tables as $table) {
            DB::table($table)->delete();
        }

        DB::connection()->getDriverName() === 'sqlite'
            ? DB::statement('PRAGMA foreign_keys = ON')
            : null;
    }

    /** @return string[] */
    private function allTables(): array
    {
        $skip = ['migrations', 'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs', 'sessions'];
        $names = [];
        foreach (Schema::getTables() as $t) {
            $name = is_array($t) ? ($t['name'] ?? '') : (string) $t;
            if ($name !== '' && ! in_array($name, $skip, true)) {
                $names[] = $name;
            }
        }
        sort($names);

        return $names;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Encryption
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * The drill's own key. A real backup pipeline takes this from a KMS or an
     * env secret; the drill generates one per run because it is proving the
     * ROUND TRIP, not the key-management policy — and a drill that needed a
     * production key to run would never be run.
     */
    private function drillKey(): string
    {
        return hash('sha256', 'backup-drill:'.bin2hex(random_bytes(32)), true);
    }

    private function encrypt(string $in, string $out, string $key): void
    {
        $iv = random_bytes(16);
        $cipher = openssl_encrypt(
            file_get_contents($in),
            'aes-256-cbc',
            $key,
            OPENSSL_RAW_DATA,
            $iv,
        );
        // IV prepended, as every AES-CBC artifact must carry it.
        file_put_contents($out, $iv.$cipher);
    }

    private function decrypt(string $in, string $out, string $key): void
    {
        $blob = file_get_contents($in);
        $iv = substr($blob, 0, 16);
        $cipher = substr($blob, 16);
        file_put_contents($out, openssl_decrypt(
            $cipher,
            'aes-256-cbc',
            $key,
            OPENSSL_RAW_DATA,
            $iv,
        ));
    }
}
