<?php

namespace App\Billing;

/**
 * The outcome of an attempted transition. A value object rather than a bool,
 * because "did not apply" has three genuinely different meanings and collapsing
 * them is how edge case #118 turns into silent state corruption:
 *
 *   - `applied`       — the state moved, a transition row exists.
 *   - `ignored_stale` — an OLDER provider event; correctly refused, not an error.
 *   - `conflict`      — the optimistic lock lost; the caller may retry.
 */
final class TransitionResult
{
    private function __construct(
        public readonly string $outcome,
        public readonly ?EntitlementState $from = null,
        public readonly ?EntitlementState $to = null,
        public readonly ?string $detail = null,
    ) {}

    public static function applied(EntitlementState $from, EntitlementState $to): self
    {
        return new self('applied', $from, $to);
    }

    public static function ignoredStale(string $detail): self
    {
        return new self('ignored_stale', null, null, $detail);
    }

    public static function conflict(): self
    {
        return new self('conflict');
    }

    public function wasApplied(): bool
    {
        return $this->outcome === 'applied';
    }
}
