<!doctype html>
<html>
<body style="font-family: -apple-system, sans-serif; color: #111;">
<h1 style="font-size: 18px;">P1: {{ $check }}</h1>

<p><strong>Night:</strong> {{ $night }} UTC — this <strong>resets the 7-night launch window</strong>.</p>

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
