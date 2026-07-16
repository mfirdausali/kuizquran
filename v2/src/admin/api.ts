// v2-D54/ROADMAP Phase 6: thin fetch wrapper for the admin API — reuses the
// SAME Sanctum bearer token every other authenticated call uses (sync/auth.ts);
// there is no separate "admin session." A 401/403 here means "not signed in as
// an allow-listed admin," which Admin.tsx surfaces as a plain message rather
// than a crash.

import { API_URL, getToken } from "../sync/auth.ts";

export class AdminApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) throw new AdminApiError(401, "not signed in");
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new AdminApiError(res.status, body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface Metric {
  key: string;
  label: string;
  value: string | null;
  target: string;
  n: number;
  note: string | null;
}

export interface ConfusionPair {
  ayah: number;
  position: number;
  chosen: string;
  count: number;
}

export function fetchMetrics(): Promise<{ metrics: Metric[]; confusionPairs: ConfusionPair[] }> {
  return request("/admin/metrics");
}

export interface AdminUserSummary {
  id: number;
  email: string | null;
  isAnonymous: boolean;
  events: number;
}

export function fetchUsers(): Promise<{ users: AdminUserSummary[] }> {
  return request("/admin/users");
}

export interface UserDrillDown {
  id: number;
  email: string | null;
  isAnonymous: boolean;
  ayatEncoded: number;
  gatesPassed: number;
  gatesTotal: number;
  avgLatencyMs: number | null;
  activeDays: number;
  confusionPairs: ConfusionPair[];
}

export function fetchUser(id: number): Promise<UserDrillDown> {
  return request(`/admin/users/${id}`);
}

export interface Frontier {
  surah: number;
  ayahCount: number;
  verifiedThrough: number;
  learnerFrontier: number;
  bufferAyat: number;
}

export function fetchFrontier(surah: number, ayahCount: number): Promise<Frontier> {
  return request(`/admin/frontier?surah=${surah}&ayahCount=${ayahCount}`);
}

export function markVerified(surah: number, ayah: number, note?: string): Promise<unknown> {
  return request("/admin/verifications", {
    method: "POST",
    body: JSON.stringify({ surah, ayah, note }),
  });
}

export interface VerificationRow {
  surah: number;
  ayah: number;
  verified_by: string | null;
  note: string | null;
  created_at: number;
}

export function fetchVerifications(surah: number): Promise<{ verifications: VerificationRow[] }> {
  return request(`/admin/verifications?surah=${surah}`);
}

export interface CreateOverrideInput {
  surah: number;
  ayah: number;
  position?: number | null;
  questionType: string;
  field: "gloss" | "distractor" | "group" | "disable" | "custom";
  payload: unknown;
  note?: string;
}

export function createOverride(input: CreateOverrideInput): Promise<unknown> {
  return request("/admin/overrides", { method: "POST", body: JSON.stringify(input) });
}
