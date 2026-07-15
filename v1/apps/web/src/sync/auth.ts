// Client auth: exchange a Google credential for a session cookie, then adopt the
// anonymous local history by flushing the ENTIRE local log (FR7 anonymous-first).
// In dev the credential is a mock JSON {sub,email}; in prod it's the GIS ID token.

import { flush, WORKER_URL } from "./outbox.ts";

export interface SignInResult {
  ok: boolean;
  email?: string;
  error?: string;
}

/**
 * POST the Google credential to /auth/google (sets the HttpOnly session cookie),
 * then adopt: flush the full local log so every anonymous event is stamped with
 * the now-authenticated user_id server-side (idempotent by event id).
 */
export async function signInWithGoogle(credential: string): Promise<SignInResult> {
  let res: Response;
  try {
    res = await fetch(`${WORKER_URL}/auth/google`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential }),
    });
  } catch (e) {
    return { ok: false, error: `network: ${String(e)}` };
  }
  if (!res.ok) return { ok: false, error: `auth ${res.status}` };
  const body = (await res.json()) as { email?: string };

  // Adoption: push the whole local history under the new session.
  await flush(true);

  return { ok: true, email: body.email };
}

/** Dev helper: build a mock credential (used by the local sign-in button). */
export function mockCredential(sub: string, email: string): string {
  return JSON.stringify({ sub, email });
}
