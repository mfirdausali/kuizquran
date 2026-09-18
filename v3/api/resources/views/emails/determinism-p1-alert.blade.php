<!doctype html>
<html>
<body style="font-family: -apple-system, sans-serif; color: #111;">
<h1 style="font-size: 18px;">P1: {{ $check }}</h1>

<p><strong>Night:</strong> {{ $night }} UTC — this <strong>resets the 7-night launch window</strong>.</p>

<p><strong>Triggered by:</strong> {{ $trigger }}.</p>

@if ($kind === 'selection')
<p>
The nightly selection-replay check found that shuffling a committed event
log under one or more seeds reproduced a <strong>different</strong>
selection trace (siteKey/deviceId/visitOrdinal → lane/variant) than the
canonical-order baseline. Selection determinism — the guarantee that
rotation and lane/variant choice reproduce regardless of arrival order — is
broken for at least one trace under the currently deployed engine version.
</p>

<ul>
    <li>Seeds compared: <strong>{{ $seedsCompared }}</strong></li>
    <li>Events replayed: {{ $eventsReplayed }}</li>
    <li>Traces compared: {{ $tracesCompared }}</li>
    <li>Divergent traces: <strong>{{ $divergentTraces }}</strong></li>
</ul>
@else
<p>
The nightly determinism check found a live <code>atom_cache</code> row that
disagrees with a fresh fold of the same learner's event log, under the
currently deployed engine version. Invariant #2 ("the append-only event log
is truth") is broken for at least one learner until this is investigated.
</p>

<ul>
    <li>Divergent atoms: <strong>{{ $divergentCount }}</strong></li>
    <li>Skewed atoms (different engine version, not this alert's cause): {{ $skewCount }}</li>
    <li>Atoms compared: {{ $atomsCompared }}</li>
    <li>Learners sampled: {{ $usersChecked }}</li>
</ul>
@endif

<p>
Run <code>php artisan nightly:window</code> for the current streak, or open
the admin System Health page for the full per-atom findings.
</p>

<p>
This is an automated page. No learner-identifying information is included —
see the admin console's audited reveal path for anything beyond internal
user ids.
</p>
</body>
</html>
