// THE `/reset-password` QUERY-STRING CONTRACT — mirrors
// `lib/drill/handoff.ts`/`lib/practice/handoff.ts`'s own convention: pure
// parse of a hand-editable URL, degrading to `null` rather than a throw on
// anything malformed or absent (edge case #78).
//
// The exact shape read here is produced by the emailed reset link, built
// server-side in `v3/api/app/Providers/AppServiceProvider.php`'s
// `ResetPassword::createUrlUsing` closure:
// `{frontend}/reset-password?token={token}&email={urlencoded email}`.

/** A resolved reset-link visit: the token+email pair to confirm against. */
export interface ResetLinkParams {
  readonly token: string;
  readonly email: string;
}

/** The raw `/reset-password` query params this contract reads. */
export interface RawResetLinkParams {
  token?: string;
  email?: string;
}

/**
 * Parse `/reset-password` search params into a `ResetLinkParams`, or `null`
 * when the link is missing its token or email (a bare visit, a truncated
 * link, a hand-edited URL) — never a throw.
 */
export function parseResetLinkParams(params: RawResetLinkParams): ResetLinkParams | null {
  if (typeof params.token !== "string" || params.token === "") return null;
  if (typeof params.email !== "string" || params.email === "") return null;
  return { token: params.token, email: params.email };
}
