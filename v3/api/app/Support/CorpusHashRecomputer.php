<?php

namespace App\Support;

use App\Console\Commands\IngestHashesCommand;
use App\Models\Override;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

/**
 * DEFECTS.md#B3's own named live gap, closed: "the LIVE wiring that
 * automatically re-runs corpus:ingest-hashes with an override-aware
 * recompute the moment an override is written." Before this, closing the
 * loop end-to-end required a human to hand-run `corpus:ingest-hashes`
 * again after every override — the computation
 * (`ayahQariHashWithOverrides`/`ayahAdminHashWithOverrides`, v3-D34) and the
 * frontier logic (`VerificationsController`'s any-row-matches predicate)
 * were both already correct; only the trigger between them was missing.
 *
 * v3-D08: Laravel never computes a hash. This class shells out to the ONE
 * hash implementation (corpus-compiler's `recomputeHashes.ts`) exactly the
 * way `DeterminismCheckCommand` shells out to the fold-runner — Laravel
 * reads, TS computes, Laravel records the verdict.
 *
 * Runs SYNCHRONOUSLY, inside the request that wrote the override, rather
 * than via a queued job. Deliberate: a queued job would need a worker
 * process running somewhere, which is exactly the "needs a host" gap
 * LAUNCH-CHECKLIST gate 20 already names for the nightly scheduler — adding
 * a second thing that silently does nothing without one would be the same
 * defect in a new place. An admin override is rare, low-traffic content
 * work; the node subprocess for a launch-sized surah runs in well under a
 * second, so paying that latency inline is cheaper than inventing a queue
 * dependency this build does not otherwise have.
 *
 * NEVER blocks the override write. The override is real admin content and
 * must be saved whether or not the corpus for its surah has been compiled
 * yet (a fresh surah's overrides can predate its first compile). A failed
 * recompute is reported back to the caller and logged — loud, never
 * silent — but it never turns a 201 into an error response.
 */
class CorpusHashRecomputer
{
    /**
     * @return array{ok:bool,rows?:int,error?:string}
     */
    public function recompute(int $surah): array
    {
        $compilerPath = (string) config('corpus.compiler_path');
        $script = $compilerPath.'/src/recomputeHashes.ts';
        $corpusPath = $compilerPath.'/output/'.$surah.'/corpus.json';
        $node = (string) config('corpus.node_bin', 'node');

        if (! is_file($script)) {
            return $this->reportFailure($surah, "corpus-compiler script not found: {$script}");
        }
        if (! is_file($corpusPath)) {
            return $this->reportFailure(
                $surah,
                "surah {$surah} has never been compiled (no {$corpusPath}) — run \`make compile-corpus\`; the override is still saved",
            );
        }

        $overrides = Override::where('surah', $surah)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get()
            ->map(fn (Override $o) => [
                'ayah' => $o->ayah,
                'position' => $o->position,
                'field' => $o->field,
                'payload' => $o->payload,
                'createdAt' => $o->created_at,
                'id' => $o->id,
            ])
            ->values()
            ->all();

        $process = new Process([$node, '--experimental-strip-types', $script, $corpusPath], null, null, json_encode($overrides), 30);
        $process->run();

        $out = trim($process->getOutput());
        $decoded = json_decode($out, true);

        if ($process->getExitCode() !== 0 || ! is_array($decoded)) {
            $error = is_array($decoded) && isset($decoded['error'])
                ? (string) $decoded['error']
                : 'recompute produced no parseable JSON table';

            return $this->reportFailure($surah, $error);
        }

        try {
            IngestHashesCommand::ingestRows($surah, $decoded);
        } catch (\Throwable $e) {
            return $this->reportFailure($surah, 'ingest failed after a successful recompute: '.$e->getMessage());
        }

        return ['ok' => true, 'rows' => count($decoded)];
    }

    /** @return array{ok:bool,error:string} */
    private function reportFailure(int $surah, string $error): array
    {
        // No override payload text in the log line (A.4's "no PII in logs"
        // discipline, applied here even though overrides carry no identity —
        // a gloss/distractor payload is still unreviewed free text).
        Log::warning('corpus hash recompute failed after an override write', [
            'surah' => $surah,
            'error' => $error,
        ]);

        return ['ok' => false, 'error' => $error];
    }
}
