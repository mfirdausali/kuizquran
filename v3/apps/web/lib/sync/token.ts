"use client";

// Token storage, and the half of DEFECTS.md#B8 that is about STATE.
//
// B8, verbatim:
//
//     `auth.ts:51-52` — `ensureDevice()` returns early if *any* token exists,
//     and `clearToken()` is never called on a 401 anywhere in `src/`. A revoked
//     token permanently disables sync; the only recovery is hand-clearing
//     localStorage.
//
// The wedge is the CONJUNCTION, not either half. Either one alone is
// survivable:
//
//   - a missing 401 handler with an honest early-return would still recover
//     once something else cleared the token;
//   - an early-return on "any token exists" with a working clear-on-401 would
//     recover because there would be nothing left to return early on.
//
// So this module breaks the conjunction at BOTH points:
//
//   1. `hasLiveToken()` — the early-return predicate — is "a token exists AND
//      has not been marked dead", never "a token string exists".
//   2. `clearToken()` exists, is exported, and `apiFetch` calls it on 401
//      BEFORE any await that could be interrupted.
//
// Storage is `localStorage`, deliberately NOT IndexedDB: a bearer token is not
// log data, it must not be entangled with the event store's transactions, and
// `clearToken()` must be able to run synchronously on a 401 with no `await`
// between "we know the token is dead" and "the token is gone".

const TOKEN_KEY = "iq3:token";
/** Which server identity the stored token belongs to. Used by the pull cursor
 *  (a cursor is meaningless across identities — see cursor.ts). */
const IDENTITY_KEY = "iq3:identity";

/** In-memory mirror, so a platform that refuses localStorage (Safari private
 *  mode has historically thrown on `setItem`) still syncs for the lifetime of
 *  the tab rather than failing closed. */
let memoryToken: string | null = null;
let memoryIdentity: string | null = null;

/** Set when a 401 proves the current token is dead. Cleared on a successful
 *  mint. This is what makes the early-return predicate honest. */
let tokenIsDead = false;

function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  const store = storage();
  if (store) {
    try {
      const v = store.getItem(TOKEN_KEY);
      if (v) return v;
    } catch {
      /* fall through to the memory mirror */
    }
  }
  return memoryToken;
}

export function setToken(token: string, identity?: string | null): void {
  memoryToken = token;
  // A freshly minted token is alive by definition. This is the ONLY place the
  // dead marker is cleared — clearing it anywhere else would let a dead token
  // be treated as live again and re-open B8.
  tokenIsDead = false;
  const store = storage();
  try {
    store?.setItem(TOKEN_KEY, token);
  } catch {
    /* memory mirror already holds it */
  }
  if (identity !== undefined) setIdentity(identity);
}

/**
 * Mark the current token DEAD without removing it.
 *
 * This is B8's first half ON ITS OWN, and it is a separate function from
 * `clearToken()` for a reason discovered by mutation testing: when clearing
 * and marking were the same action, the dead-marker was ARCHITECTURALLY INERT.
 * Removing the marker changed no observable behaviour, because the token was
 * gone anyway — so the mutation "restore v2's `ensureDevice()` early-return on
 * any-token-exists" SURVIVED. A guard whose test cannot distinguish the two
 * states it guards is exactly v3-D49's pattern.
 *
 * Splitting them makes each half independently observable:
 *   - mark-only  ⇒ the token is still readable but is NEVER ATTACHED;
 *   - clear-only ⇒ the token is gone.
 * The 401 path does both, so breaking either one is now detectable.
 */
export function markTokenDead(): void {
  tokenIsDead = true;
}

/**
 * Forget the token. Called on 401 BEFORE the re-mint, so that even if the
 * early-return logic were later broken again there is nothing left to return
 * early on. Synchronous by design: no await may sit between "this token is
 * dead" and "this token is gone".
 */
export function clearToken(): void {
  markTokenDead();
  memoryToken = null;
  const store = storage();
  try {
    store?.removeItem(TOKEN_KEY);
  } catch {
    /* memory mirror already cleared */
  }
}

/**
 * The early-return predicate, B8's first half.
 *
 * NOT `getToken() !== null`. A token that has just 401'd is present-but-dead,
 * and treating presence as liveness is precisely the line B8 names. The
 * `tokenIsDead` term is load-bearing on its own: a token marked dead but still
 * stored (see `markTokenDead`) must NOT be attached to a request.
 */
export function hasLiveToken(): boolean {
  return !tokenIsDead && getToken() !== null;
}

/** True once a 401 has been observed and not yet recovered from. */
export function isTokenDead(): boolean {
  return tokenIsDead;
}

export function getIdentity(): string | null {
  const store = storage();
  if (store) {
    try {
      const v = store.getItem(IDENTITY_KEY);
      if (v) return v;
    } catch {
      /* fall through */
    }
  }
  return memoryIdentity;
}

export function setIdentity(identity: string | null): void {
  memoryIdentity = identity;
  const store = storage();
  try {
    if (identity === null) store?.removeItem(IDENTITY_KEY);
    else store?.setItem(IDENTITY_KEY, identity);
  } catch {
    /* memory mirror already holds it */
  }
}

/** Test seam: return to a pristine, token-less state. */
export function resetTokenForTests(): void {
  memoryToken = null;
  memoryIdentity = null;
  tokenIsDead = false;
  const store = storage();
  try {
    store?.removeItem(TOKEN_KEY);
    store?.removeItem(IDENTITY_KEY);
  } catch {
    /* nothing to do */
  }
}
