// THE `/verify-email` QUERY-STRING CONTRACT — mirrors
// `lib/account/resetLink.ts`'s own convention exactly: a pure parse of a
// hand-editable URL, degrading to `null` on anything malformed or absent
// (edge case #78), never a throw.
//
// Unlike the reset-password link (which carries only a token+email pair —
// `PasswordResetController::reset()` validates the token itself, no signed
// URL involved), this one carries all FOUR pieces
// `GET /api/email/verify/{id}/{hash}?expires=&signature=` needs to
// reconstruct the exact signed, `auth:sanctum`-gated backend call the
// notification was minted for. The shape is built server-side in
// `v3/api/app/Providers/AppServiceProvider.php`'s `VerifyEmail::createUrlUsing`
// closure: `{frontend}/verify-email?id={id}&hash={hash}&expires={expires}&signature={signature}`
// — read straight off the real `URL::temporarySignedRoute('verification.verify', ...)`
// call Laravel's own `VerifyEmail` notification would otherwise have used.

/** A resolved verify-email link visit: the four pieces needed to reconstruct
 *  the signed backend call. */
export interface VerifyLinkParams {
  readonly id: string;
  readonly hash: string;
  readonly expires: string;
  readonly signature: string;
}

/** The raw `/verify-email` query params this contract reads. */
export interface RawVerifyLinkParams {
  id?: string;
  hash?: string;
  expires?: string;
  signature?: string;
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v !== "";
}

/**
 * Parse `/verify-email` search params into a `VerifyLinkParams`, or `null`
 * when any of the four is missing (a bare visit, a truncated link, a
 * hand-edited URL) — never a throw.
 */
export function parseVerifyLinkParams(params: RawVerifyLinkParams): VerifyLinkParams | null {
  if (!nonEmptyString(params.id)) return null;
  if (!nonEmptyString(params.hash)) return null;
  if (!nonEmptyString(params.expires)) return null;
  if (!nonEmptyString(params.signature)) return null;
  return { id: params.id, hash: params.hash, expires: params.expires, signature: params.signature };
}
