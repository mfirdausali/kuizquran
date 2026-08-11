<?php

namespace App\Billing;

/**
 * Tier is ORTHOGONAL to state (see the entitlements migration). Edge case #113's
 * merge rule is `max(tier)` over this ladder: `none < monthly < lifetime`.
 */
enum EntitlementTier: string
{
    case None = 'none';
    case Monthly = 'monthly';
    case Lifetime = 'lifetime';

    public function rank(): int
    {
        return match ($this) {
            self::None => 0,
            self::Monthly => 1,
            self::Lifetime => 2,
        };
    }

    /** Edge case #113: "max(tier) survives". */
    public static function max(self $a, self $b): self
    {
        return $a->rank() >= $b->rank() ? $a : $b;
    }
}
