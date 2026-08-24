"use client";

// THE ADMIN IDENTITY CONTEXT — the missing half of role-based UI gating,
// named unaddressed in DECISIONS.md v3-D127's own closing note and repeated
// through v3-D128/D129/D130: "role-based UI gating within the admin console
// (AdminGate proves ADMIN, not WHICH admin role)."
//
// `GET /api/admin/whoami` has returned the caller's own `roles` since
// v3-D127 shipped `AdminGate` — but `AdminGate` only ever PRINTED them in
// its session bar; nothing downstream could read them, so every admin
// screen offered every role-gated affordance to every admin regardless of
// role, relying on the server's own rejection to catch the mismatch after
// the fact. This context threads the identity `AdminGate` already fetched
// down to descendants without a second network round-trip.
//
// DENY BY DEFAULT. `useAdminRoles()` returns `[]` — never throws, never
// assumes — when no provider is present (e.g. a component rendered outside
// `AdminGate`, such as in isolation in a test). An absent identity must
// read as "no roles", the same posture `EnsureIsAdmin` itself takes on an
// empty allowlist: fail closed, never open.

import { createContext, useContext, type ReactNode } from "react";
import type { AdminIdentity } from "./session";

const AdminIdentityContext = createContext<AdminIdentity | null>(null);

export function AdminIdentityProvider({
  identity,
  children,
}: {
  identity: AdminIdentity;
  children: ReactNode;
}) {
  return <AdminIdentityContext.Provider value={identity}>{children}</AdminIdentityContext.Provider>;
}

/** The caller's own admin roles, or `[]` with no provider — see the header:
 *  this is a deny-by-default read, never a thrown error. */
export function useAdminRoles(): readonly string[] {
  const identity = useContext(AdminIdentityContext);
  return identity?.roles ?? [];
}
