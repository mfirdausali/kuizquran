<?php

namespace App\Http\Controllers\Admin;

/**
 * WIREFRAME §16: "Every learner is pseudonymous everywhere (`u_7f3a…`)."
 *
 * A deterministic HMAC of the user id under a server-side pepper:
 *   - STABLE across sessions, so an operator can correlate a support thread
 *     without ever seeing an email;
 *   - NOT REVERSIBLE without the pepper, so a leaked audit log or CSV export
 *     does not deanonymise anyone;
 *   - NOT a raw hash of the id, which would be trivially rainbow-tabled given
 *     that user ids are small integers.
 */
class Pseudonymizer
{
    public function for(int $userId): string
    {
        $pepper = (string) config('admin.pseudonym_pepper', '');

        // An unset pepper must not silently degrade to an unsalted, reversible
        // digest — that would be a privacy failure that looks like it works.
        if ($pepper === '') {
            throw new \RuntimeException(
                'ADMIN_PSEUDONYM_PEPPER is not set. Pseudonyms would be reversible by brute force over user ids.',
            );
        }

        return 'u_'.substr(hash_hmac('sha256', (string) $userId, $pepper), 0, 12);
    }
}
