<?php

namespace App\Billing;

/**
 * A paywall answer, with its reason attached.
 *
 * The reason is not decoration: the admin billing surface shows it, and "why was
 * this learner blocked" is otherwise unanswerable without re-running the gate.
 */
final class PaywallDecision
{
    private function __construct(
        public readonly bool $permitted,
        public readonly ?string $code,
        public readonly string $reason,
    ) {}

    public static function allow(string $reason): self
    {
        return new self(true, null, $reason);
    }

    public static function deny(string $code, string $reason): self
    {
        return new self(false, $code, $reason);
    }
}
