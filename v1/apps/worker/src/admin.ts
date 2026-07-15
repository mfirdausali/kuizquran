// /admin monitor (FR8). Read-only, ADMIN_EMAILS-gated, server-rendered HTML that
// consumes iman-ui.css. Panels = exactly the §3 metrics table + per-user
// drill-down. No metric outside §3 (the rule); no mutation routes.

import type { Context } from "hono";
import type { Env } from "./env.ts";
import { allMetrics, confusionPairs, type MetricResult } from "./metrics.ts";

const CSS_HREF = "/iman-ui.css"; // served same-site by Pages

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${CSS_HREF}"><title>${esc(title)}</title>
<style>.admin{max-width:720px;margin:0 auto;padding:16px}
table{width:100%;border-collapse:collapse}
td,th{padding:8px 6px;border-bottom:var(--hairline) solid var(--border);text-align:left;font-size:13px}
th{color:var(--text-secondary);font-weight:500}.muted{color:var(--text-muted)}</style>
</head><body><div class="admin">${body}</div></body></html>`;
}

function metricRow(m: MetricResult): string {
  const val = m.value ?? `<span class="muted">— ${esc(m.note ?? "not available")}</span>`;
  return `<tr><td>${esc(m.label)}</td><td>${val}</td><td class="muted">${esc(m.target)}</td><td class="muted">${m.n}</td></tr>`;
}

// GET /admin — the §3 metrics table, live.
export async function adminHome(c: Context<{ Bindings: Env; Variables: { uid: number } }>): Promise<Response> {
  const metrics = await allMetrics(c.env.DB);
  const users = await c.env.DB.prepare(
    `SELECT u.id, u.email, COUNT(e.id) AS events
     FROM users u LEFT JOIN events e ON e.user_id = u.id
     GROUP BY u.id ORDER BY events DESC`,
  ).all<{ id: number; email: string; events: number }>();

  const rows = metrics.map(metricRow).join("");
  const userRows = users.results
    .map(
      (u) =>
        `<tr><td><a href="/api/admin/user/${u.id}">${esc(u.email)}</a></td><td class="muted">${u.events}</td></tr>`,
    )
    .join("");

  const body = `
    <div class="card">
      <div class="card-header"><span>iman · admin</span><span>prelude metrics (§3)</span></div>
      <table><thead><tr><th>Metric</th><th>Live</th><th>Target</th><th>n</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <p class="caption">Read-only. If a metric isn't here, the prelude isn't measuring it.</p>
    </div>
    <div class="card">
      <div class="card-header"><span>Users</span><span>${users.results.length}</span></div>
      <table><thead><tr><th>Email</th><th>Events</th></tr></thead><tbody>${userRows || '<tr><td class="muted" colspan="2">no users yet</td></tr>'}</tbody></table>
    </div>`;
  return c.html(page("iman · admin", body));
}

// GET /admin/user/:id — per-user drill-down (stage distribution, weak
// connections, streak, time-per-word).
export async function adminUser(c: Context<{ Bindings: Env; Variables: { uid: number } }>): Promise<Response> {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.text("bad id", 400);
  const u = await c.env.DB.prepare("SELECT id, email FROM users WHERE id = ?")
    .bind(id)
    .first<{ id: number; email: string }>();
  if (!u) return c.text("not found", 404);

  // stage distribution: encoded ayat by band is a client-side (atoms) concept;
  // server approximates via event signals (encoded = has S3 rung_complete).
  const encoded = await c.env.DB.prepare(
    `SELECT COUNT(DISTINCT ayah) AS n FROM events WHERE user_id = ? AND type='rung_complete' AND rung='S3'`,
  ).bind(id).first<{ n: number }>();
  const gates = await c.env.DB.prepare(
    `SELECT SUM(CASE WHEN correct=1 THEN 1 ELSE 0 END) AS passed, COUNT(*) AS total
     FROM events WHERE user_id=? AND type='gate_result'`,
  ).bind(id).first<{ passed: number | null; total: number }>();
  const latency = await c.env.DB.prepare(
    `SELECT AVG(latency) AS avg FROM events WHERE user_id=? AND type='tap' AND latency IS NOT NULL AND latency<=300000`,
  ).bind(id).first<{ avg: number | null }>();
  const pairs = (await confusionPairs(c.env.DB, 10)).filter((p) => true); // global pairs (weak connections)
  const activeDays = await c.env.DB.prepare(
    `SELECT COUNT(DISTINCT CAST((ts - 16200000)/86400000 AS INT)) AS days FROM events WHERE user_id=?`,
  ).bind(id).first<{ days: number }>();

  const pairRows = pairs
    .map((p) => `<tr><td>12:${p.ayah}·${p.position}</td><td>${esc(p.chosen)}</td><td class="muted">${p.count}</td></tr>`)
    .join("");

  const body = `
    <p class="caption"><a href="/api/admin">← all users</a></p>
    <div class="card">
      <div class="card-header"><span>${esc(u.email)}</span><span>user ${u.id}</span></div>
      <table><tbody>
        <tr><td>Ayat encoded</td><td>${encoded?.n ?? 0}</td></tr>
        <tr><td>Cold gates</td><td>${gates?.passed ?? 0} / ${gates?.total ?? 0} passed</td></tr>
        <tr><td>Avg time-per-word</td><td>${latency?.avg != null ? (latency.avg / 1000).toFixed(1) + " s" : '<span class="muted">—</span>'}</td></tr>
        <tr><td>Active learning-days (streak state)</td><td>${activeDays?.days ?? 0}</td></tr>
      </tbody></table>
    </div>
    <div class="card">
      <div class="card-header"><span>Weak spots (top confused choices)</span></div>
      <table><thead><tr><th>Word</th><th>Chosen instead</th><th>×</th></tr></thead>
      <tbody>${pairRows || '<tr><td class="muted" colspan="3">no slips recorded</td></tr>'}</tbody></table>
    </div>`;
  return c.html(page(`iman · admin · ${u.email}`, body));
}
