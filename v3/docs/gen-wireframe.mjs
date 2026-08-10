#!/usr/bin/env node
// Generates a real .excalidraw scene for Kuiz Quran v3 (Next.js).
// Design tokens lifted from v1/styles/iman-ui.css (locked design system).
import { writeFileSync } from "node:fs";

const T = {
  ink: "#1f1e1b",
  sec: "#5f5d55",
  muted: "#918f86",
  border: "#adaba3",
  teal: "#1d9e75",
  tealBg: "#e1f5ee",
  coral: "#d85a30",
  coralBg: "#faece7",
  purple: "#6c5bb8",
  purpleBg: "#ece7f8",
  amber: "#ba7517",
  amberBg: "#faeeda",
  surface: "#f5f4ee",
  white: "#ffffff",
  transparent: "transparent",
};

let seed = 1;
const els = [];
const id = (p) => `${p}-${seed++}`;

function base(extra) {
  return {
    id: extra.id ?? id("el"),
    angle: 0,
    strokeColor: T.ink,
    backgroundColor: T.transparent,
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: Math.floor(seed * 7919) % 2147483647,
    version: 1,
    versionNonce: Math.floor(seed * 104729) % 2147483647,
    isDeleted: false,
    boundElements: [],
    updated: 1,
    link: null,
    locked: false,
    ...extra,
  };
}

function rect(x, y, w, h, o = {}) {
  const e = base({
    type: "rectangle",
    x, y, width: w, height: h,
    roundness: o.sharp ? null : { type: 3 },
    ...o,
  });
  delete e.sharp;
  els.push(e);
  return e;
}

function ellipse(x, y, w, h, o = {}) {
  const e = base({ type: "ellipse", x, y, width: w, height: h, ...o });
  els.push(e);
  return e;
}

const FONT = { hand: 5, normal: 2, code: 3 };

function text(x, y, str, o = {}) {
  const size = o.fontSize ?? 16;
  const family = o.fontFamily ?? FONT.hand;
  const lines = String(str).split("\n");
  // Arabic combining marks (harakat) render zero-width; counting them inflates
  // the box and pushes text past its frame. Strip them for the width estimate.
  const visibleLen = (l) => l.replace(/[ً-ْٰ]/g, "").length;
  const w = o.width ?? Math.max(...lines.map(visibleLen)) * size * 0.55;
  const h = lines.length * size * 1.25;
  const e = base({
    type: "text",
    x, y, width: w, height: h,
    text: String(str),
    originalText: String(str),
    fontSize: size,
    fontFamily: family,
    textAlign: o.textAlign ?? "left",
    verticalAlign: "top",
    containerId: null,
    lineHeight: 1.25,
    strokeColor: o.strokeColor ?? T.ink,
    opacity: o.opacity ?? 100,
    angle: o.angle ?? 0,
  });
  els.push(e);
  return e;
}

function arrow(pts, o = {}) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = xs[0], y = ys[0];
  const e = base({
    type: "arrow",
    x, y,
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    points: pts.map((p) => [p[0] - x, p[1] - y]),
    strokeColor: o.strokeColor ?? T.sec,
    strokeWidth: o.strokeWidth ?? 1,
    strokeStyle: o.strokeStyle ?? "solid",
    endArrowhead: o.endArrowhead === null ? null : "arrow",
    startArrowhead: o.startArrowhead ?? null,
    roundness: { type: 2 },
    elbowed: false,
  });
  els.push(e);
  return e;
}

function line(pts, o = {}) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = xs[0], y = ys[0];
  els.push(base({
    type: "line",
    x, y,
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    points: pts.map((p) => [p[0] - x, p[1] - y]),
    strokeColor: o.strokeColor ?? T.border,
    strokeStyle: o.strokeStyle ?? "solid",
    strokeWidth: o.strokeWidth ?? 1,
    roundness: null,
  }));
}

// ---------- composite helpers ----------

// A phone-shaped screen frame with a title above it.
function phone(x, y, title, subtitle, o = {}) {
  const w = o.w ?? 300;
  const h = o.h ?? 620;
  text(x, y - 46, title, { fontSize: 20, strokeColor: T.ink });
  if (subtitle) text(x, y - 22, subtitle, { fontSize: 12, strokeColor: T.muted });
  rect(x, y, w, h, { strokeColor: T.ink, strokeWidth: 2, backgroundColor: T.white, fillStyle: "solid" });
  // status bar
  line([[x, y + 30], [x + w, y + 30]], { strokeColor: T.border });
  text(x + 14, y + 9, "9:41", { fontSize: 11, strokeColor: T.muted });
  text(x + w - 52, y + 9, "▚▚ ▮", { fontSize: 11, strokeColor: T.muted });
  return { x, y, w, h, inner: { x: x + 14, y: y + 44, w: w - 28 } };
}

// Bottom tab bar inside a phone.
function tabbar(p, active) {
  const tabs = ["Home", "Surah", "Plan", "Progress"];
  const y = p.y + p.h - 54;
  line([[p.x, y], [p.x + p.w, y]], { strokeColor: T.border });
  const tw = p.w / tabs.length;
  tabs.forEach((t, i) => {
    const cx = p.x + tw * i + tw / 2;
    const on = t === active;
    rect(cx - 11, y + 12, 22, 16, { strokeColor: on ? T.teal : T.muted, sharp: false });
    text(cx - t.length * 3.1, y + 32, t, { fontSize: 10, strokeColor: on ? T.teal : T.muted });
  });
}

// A desktop browser frame: chrome bar + optional 220px sidebar (admin shell).
function desktop(x, y, w, h, title, subtitle, o = {}) {
  text(x, y - 46, title, { fontSize: 20, strokeColor: T.ink });
  if (subtitle) text(x, y - 22, subtitle, { fontSize: 12, strokeColor: T.muted });
  rect(x, y, w, h, { strokeColor: T.ink, strokeWidth: 2, backgroundColor: T.white, fillStyle: "solid" });
  // browser chrome
  line([[x, y + 30], [x + w, y + 30]], { strokeColor: T.border });
  [0, 1, 2].forEach((i) => ellipse(x + 12 + i * 16, y + 11, 9, 9, { strokeColor: T.muted }));
  rect(x + 70, y + 7, w - 90, 17, { strokeColor: T.border, sharp: false });
  text(x + 78, y + 11, o.url ?? "", { fontSize: 9, strokeColor: T.muted });
  const sidebarW = o.sidebar === false ? 0 : 220;
  if (sidebarW) {
    line([[x + sidebarW, y + 30], [x + sidebarW, y + h]], { strokeColor: T.border });
    // topbar inside content area
    line([[x + sidebarW, y + 86], [x + w, y + 86]], { strokeColor: T.border });
  }
  return { x, y, w, h, sidebarW, content: { x: x + sidebarW, y: y + (sidebarW ? 86 : 30), w: w - sidebarW } };
}

// Sidebar nav for the admin shell.
function d_h_of(d) { return d.h; }
function sidebarNav(d, items, active) {
  const x = d.x, y = d.y + 30;
  text(x + 16, y + 14, "iman.app · operator", { fontSize: 12 });
  // Pitch adapts to item count so a long nav never overflows its frame.
  const avail = d_h_of(d) - 100;
  const pitch = Math.min(32, Math.max(20, Math.floor(avail / items.length)));
  const fs = pitch < 26 ? 10 : 12;
  let iy = y + 40;
  items.forEach((it) => {
    const on = it === active;
    const sep = it.startsWith("—");
    if (on) rect(x + 1, iy - 5, 3, pitch - 6, { strokeColor: T.teal, backgroundColor: T.teal, fillStyle: "solid", sharp: true });
    text(x + 18, iy, it, { fontSize: sep ? fs - 1 : fs, strokeColor: sep ? T.purple : on ? T.teal : T.sec });
    iy += pitch;
  });
  text(x + 18, d.y + d.h - 44, "ops@iman.app", { fontSize: 9, strokeColor: T.muted });
  text(x + 18, d.y + d.h - 28, "Sign out", { fontSize: 9, strokeColor: T.muted });
}

// A dense data table.
function table(x, y, w, cols, rows, o = {}) {
  const rh = o.rowH ?? 26;
  const colW = cols.map((c) => c[1]);
  let cx = x;
  cols.forEach((c, i) => {
    text(cx + 6, y, c[0], { fontSize: 8, strokeColor: T.muted });
    cx += colW[i];
  });
  line([[x, y + 14], [x + w, y + 14]], { strokeColor: T.border });
  let ry = y + 20;
  rows.forEach((r) => {
    cx = x;
    r.forEach((cell, i) => {
      const val = Array.isArray(cell) ? cell[0] : cell;
      const col = Array.isArray(cell) ? cell[1] : T.ink;
      text(cx + 6, ry + 6, String(val), { fontSize: 9, strokeColor: col });
      cx += colW[i];
    });
    line([[x, ry + rh - 4], [x + w, ry + rh - 4]], { strokeColor: T.border, strokeStyle: "dotted" });
    ry += rh;
  });
  return ry;
}

// A KPI stat tile.
function tile(x, y, w, h, label, value, sub, o = {}) {
  rect(x, y, w, h, {
    strokeColor: o.strokeColor ?? T.border,
    backgroundColor: o.bg ?? T.white,
    fillStyle: "solid",
    strokeWidth: o.strokeWidth ?? 1,
  });
  text(x + 10, y + 8, label, { fontSize: 8, strokeColor: T.muted });
  text(x + 10, y + 22, value, { fontSize: o.valueSize ?? 18, strokeColor: o.fg ?? T.ink });
  if (sub) text(x + 10, y + h - 18, sub, { fontSize: 8, strokeColor: T.muted });
}

function btn(x, y, w, h, label, o = {}) {
  rect(x, y, w, h, {
    strokeColor: o.strokeColor ?? T.ink,
    backgroundColor: o.bg ?? T.ink,
    fillStyle: "solid",
    strokeWidth: o.strokeWidth ?? 1,
  });
  const fs = o.fontSize ?? 13;
  text(x + w / 2 - label.length * fs * 0.28, y + h / 2 - fs * 0.62, label, {
    fontSize: fs,
    strokeColor: o.fg ?? T.white,
  });
}

function chip(x, y, label, o = {}) {
  const fs = o.fontSize ?? 11;
  const w = o.w ?? label.length * fs * 0.62 + 18;
  const h = o.h ?? 22;
  rect(x, y, w, h, {
    strokeColor: o.strokeColor ?? T.border,
    backgroundColor: o.bg ?? T.transparent,
    fillStyle: "solid",
  });
  text(x + 9, y + h / 2 - fs * 0.62, label, { fontSize: fs, strokeColor: o.fg ?? T.sec });
  return w;
}

function note(x, y, w, body, o = {}) {
  // Derive height from the content so a note can never clip its own text.
  // 12px text at lineHeight 1.25 = 15px/line, plus 12px padding top and bottom.
  const needed = String(body).split("\n").length * 15 + 24;
  const h = Math.max(o.h ?? 0, needed);
  rect(x, y, w, h, {
    strokeColor: o.strokeColor ?? T.amber,
    backgroundColor: o.bg ?? T.amberBg,
    fillStyle: "solid",
    strokeStyle: "dashed",
  });
  text(x + 12, y + 12, body, { fontSize: 12, strokeColor: o.fg ?? "#7a4d0d" });
}

function sectionTitle(x, y, n, title, sub) {
  text(x, y, `${n}`, { fontSize: 34, strokeColor: T.border });
  text(x + 48, y + 4, title, { fontSize: 26, strokeColor: T.ink });
  if (sub) text(x + 48, y + 34, sub, { fontSize: 13, strokeColor: T.muted });
}

// ============================================================
// TITLE
// ============================================================
text(80, 60, "Kuiz Quran — v3 (Next.js)", { fontSize: 44 });
text(80, 118, "Surah → Ayah → Quiz.  Macro understanding as a persistent dashboard panel.", {
  fontSize: 17, strokeColor: T.sec,
});
text(80, 146, "Wireframe · greenfield v3 · v2 (React+Vite) left untouched · design system inherited from v1 iman-ui.css", {
  fontSize: 13, strokeColor: T.muted,
});
line([[80, 178], [1500, 178]], { strokeColor: T.border, strokeWidth: 2 });

// ============================================================
// 0 · INFORMATION ARCHITECTURE
// ============================================================
sectionTitle(80, 230, "0", "Information architecture", "The route tree. Next.js App Router.");

const IA_Y = 320;
function iaBox(x, y, w, h, label, sub, o = {}) {
  rect(x, y, w, h, {
    strokeColor: o.strokeColor ?? T.ink,
    backgroundColor: o.bg ?? T.white,
    fillStyle: "solid",
    strokeWidth: o.strokeWidth ?? 1,
  });
  text(x + 12, y + 12, label, { fontSize: 14, strokeColor: o.fg ?? T.ink });
  if (sub) text(x + 12, y + 32, sub, { fontSize: 11, strokeColor: T.muted });
  return { x, y, w, h };
}

iaBox(80, IA_Y, 210, 58, "/  Dashboard", "your surahs + recommendations", { strokeWidth: 2, bg: T.tealBg });
iaBox(360, IA_Y - 90, 230, 58, "/library", "browse & pick a surah");
iaBox(360, IA_Y, 230, 58, "/surah/[id]", "MACRO panel + ayah list", { strokeWidth: 2, bg: T.purpleBg });
iaBox(360, IA_Y + 90, 230, 58, "/plan", "THE CALENDAR — predictability", { strokeWidth: 2, bg: T.amberBg });
iaBox(360, IA_Y + 180, 230, 58, "/progress", "retention receipt");
iaBox(360, IA_Y + 270, 230, 58, "/me", "profile · friends · settings", { bg: T.surface });
iaBox(680, IA_Y + 270, 230, 58, "/me/friends", "consistency-only view", { bg: T.surface });
text(360, IA_Y + 340, "§19 social surfaces — ALL admin-togglable, and all OFF by default", { fontSize: 11, strokeColor: T.muted });
iaBox(680, IA_Y, 230, 58, "/surah/[id]/ayah/[n]", "ayah detail + drill entry");
iaBox(1000, IA_Y - 45, 230, 58, "/quiz/[sessionId]", "the drill loop", { strokeWidth: 2, bg: T.coralBg });
iaBox(1000, IA_Y + 45, 230, 58, "/quiz/[sessionId]/summary", "session summary");

arrow([[290, IA_Y + 29], [360, IA_Y + 29]]);
arrow([[290, IA_Y + 20], [330, IA_Y - 61], [360, IA_Y - 61]]);
arrow([[290, IA_Y + 40], [330, IA_Y + 119], [360, IA_Y + 119]]);
arrow([[290, IA_Y + 46], [320, IA_Y + 209], [360, IA_Y + 209]]);
arrow([[590, IA_Y + 29], [680, IA_Y + 29]]);
arrow([[910, IA_Y + 20], [960, IA_Y - 16], [1000, IA_Y - 16]]);
arrow([[1115, IA_Y + 13], [1115, IA_Y + 45]], { strokeColor: T.coral });
arrow([[1000, IA_Y + 74], [930, IA_Y + 160], [195, IA_Y + 160], [195, IA_Y + 58]], {
  strokeColor: T.teal, strokeStyle: "dashed",
});
text(560, IA_Y + 168, "session ends → back to dashboard", { fontSize: 11, strokeColor: T.teal });

note(1290, IA_Y - 90, 340, "Why Next.js here is fine:\n/library and /surah/[id] are content-shaped and\nbenefit from RSC + static generation of corpus\ndata. The drill loop (/quiz) stays a client\ncomponent — it is local-first and offline.", { h: 118 });

// ============================================================
// 1 · DASHBOARD
// ============================================================
sectionTitle(80, 560, "1", "Dashboard", "Your surahs, the macro panel, and what to do next.");

const p1 = phone(120, 700, "Dashboard", "route: /");
{
  const { x, w } = p1.inner;
  let y = p1.y + 46;

  text(x, y, "Assalamualaikum, Firdaus", { fontSize: 15 });
  text(x, y + 22, "Tuesday · 4 ayat due", { fontSize: 11, strokeColor: T.muted });
  y += 52;

  // PRIMARY CTA
  rect(x, y, w, 74, { strokeColor: T.teal, backgroundColor: T.tealBg, fillStyle: "solid", strokeWidth: 2 });
  text(x + 14, y + 13, "Continue — Surah Yusuf", { fontSize: 14, strokeColor: "#085041" });
  text(x + 14, y + 34, "Ayah 12 · 4 due · ~6 min", { fontSize: 11, strokeColor: T.sec });
  btn(x + w - 92, y + 42, 78, 24, "Start", { bg: T.teal, strokeColor: T.teal });
  y += 96;

  // MY SURAHS
  text(x, y, "MY SURAHS", { fontSize: 11, strokeColor: T.muted });
  y += 22;
  const surahs = [
    ["Yusuf", "12 / 111 ayat", 0.11, T.teal],
    ["Al-Mulk", "8 / 30 ayat", 0.27, T.teal],
    ["Ar-Rahman", "paused · 3 / 78", 0.04, T.muted],
  ];
  surahs.forEach(([n, s, pct, col]) => {
    rect(x, y, w, 54, { strokeColor: T.border, backgroundColor: T.white, fillStyle: "solid" });
    text(x + 12, y + 10, n, { fontSize: 13 });
    text(x + 12, y + 30, s, { fontSize: 10, strokeColor: T.muted });
    // progress track
    rect(x + w - 96, y + 22, 82, 7, { strokeColor: T.border, sharp: true });
    rect(x + w - 96, y + 22, Math.max(4, 82 * pct), 7, {
      strokeColor: col, backgroundColor: col, fillStyle: "solid", sharp: true,
    });
    y += 62;
  });

  // RECOMMENDATION
  y += 4;
  text(x, y, "RECOMMENDED NEXT", { fontSize: 11, strokeColor: T.purple });
  y += 22;
  rect(x, y, w, 84, {
    strokeColor: T.purple, backgroundColor: T.purpleBg, fillStyle: "solid", strokeStyle: "dashed",
  });
  text(x + 12, y + 11, "Surah Al-Kahf 1–10", { fontSize: 13, strokeColor: "#332a66" });
  text(x + 12, y + 31, "Short · shares 40% vocabulary\nwith Yusuf · protection on Friday", {
    fontSize: 10, strokeColor: T.sec,
  });
  chip(x + 12, y + 56, "Why this?", { fontSize: 10, strokeColor: T.purple, fg: T.purple });
  btn(x + w - 74, y + 54, 62, 22, "Add", { bg: T.purple, strokeColor: T.purple, fontSize: 11 });

  tabbar(p1, "Home");
}

note(460, 760, 330, "THE RECOMMENDER (your ask)\nRanks candidate surahs by:\n  · length (short wins for casual learners)\n  · vocabulary overlap with what you know\n  · liturgical utility (salah, Friday, ruqyah)\n  · narrative pull\n  · current load — never recommend while\n    you are already behind\n\n'Why this?' always expands. Never a black box.", { h: 190 });

note(460, 980, 330, "MY SURAHS is the spine of the app.\nEach row = an independent memory track\nwith its own schedule. Pausing is a\nfirst-class action, not an abandonment —\ncasual learners cycle in and out.", { h: 110, strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

// ============================================================
// 2 · LIBRARY / PICKER
// ============================================================
sectionTitle(880, 560, "2", "Surah library", "Choosing what to memorize.");

const p2 = phone(920, 700, "Library", "route: /library");
{
  const { x, w } = p2.inner;
  let y = p2.y + 46;

  rect(x, y, w, 32, { strokeColor: T.border });
  text(x + 10, y + 9, "Search surah…", { fontSize: 12, strokeColor: T.muted });
  y += 44;

  let cx = x;
  ["All", "Short", "Popular", "Juz 30"].forEach((c, i) => {
    cx += chip(cx, y, c, i === 1 ? { bg: T.ink, fg: T.white, strokeColor: T.ink } : {}) + 6;
  });
  y += 38;

  const rows = [
    ["Al-Fatihah", "7 ayat · foundational", "✓ done", T.teal],
    ["Al-Mulk", "30 ayat · in progress", "58%", T.teal],
    ["Al-Kahf", "110 ayat · recommended", "★", T.purple],
    ["Yasin", "83 ayat", "+", T.muted],
    ["Ar-Rahman", "78 ayat · paused", "⏸", T.muted],
    ["An-Naba", "40 ayat", "+", T.muted],
  ];
  rows.forEach(([n, s, badge, col]) => {
    rect(x, y, w, 50, { strokeColor: T.border });
    text(x + 12, y + 10, n, { fontSize: 13 });
    text(x + 12, y + 29, s, { fontSize: 10, strokeColor: T.muted });
    text(x + w - 34, y + 18, badge, { fontSize: 12, strokeColor: col });
    y += 56;
  });

  tabbar(p2, "Surah");
}

note(1260, 700, 330, "Picking a surah is a COMMITMENT, not a\nbrowse. Tapping '+' opens a short confirm:\nestimated days to memorize at your pace,\nand what it does to your daily load.\n\nThis is the guardrail against collecting\nsurahs you never finish — the #1 failure\nmode for casual learners.", { h: 160 });

// ============================================================
// 3 · SURAH DETAIL — the macro panel
// ============================================================
sectionTitle(80, 1440, "3", "Surah page — macro panel + ayah list", "Where macro understanding lives. Persistent, ambient, never a gate.");

const p3 = phone(120, 1580, "Surah detail", "route: /surah/[id]", { h: 760 });
{
  const { x, w } = p3.inner;
  let y = p3.y + 46;

  text(x, y, "Surah Yusuf", { fontSize: 18 });
  text(x, y + 24, "111 ayat · Makkiyyah · The most beautiful story", { fontSize: 10, strokeColor: T.muted });
  y += 50;

  // ===== MACRO PANEL (persistent) =====
  rect(x, y, w, 250, {
    strokeColor: T.purple, backgroundColor: T.purpleBg, fillStyle: "solid", strokeWidth: 2,
  });
  text(x + 12, y + 11, "THE SHAPE OF THIS SURAH", { fontSize: 10, strokeColor: T.purple });
  text(x + w - 52, y + 11, "collapse", { fontSize: 9, strokeColor: T.muted });

  // one-line spine
  text(x + 12, y + 30, "A dream → a pit → a palace → a prison\n→ a throne → a family made whole.", {
    fontSize: 11, strokeColor: "#332a66",
  });

  // ring composition
  const rcx = x + w / 2, rcy = y + 152, rr = 52;
  ellipse(rcx - rr, rcy - rr, rr * 2, rr * 2, { strokeColor: T.purple, strokeStyle: "dashed" });
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 * i) / 12 - Math.PI / 2;
    const px = rcx + Math.cos(a) * rr - 7;
    const py = rcy + Math.sin(a) * rr - 7;
    const done = i < 2;
    ellipse(px, py, 14, 14, {
      strokeColor: done ? T.teal : T.purple,
      backgroundColor: done ? T.teal : T.white,
      fillStyle: "solid",
    });
  }
  // mirror chords
  line([[rcx, rcy - rr], [rcx, rcy + rr]], { strokeColor: T.purple, strokeStyle: "dotted" });
  line([[rcx - rr * 0.87, rcy - rr * 0.5], [rcx + rr * 0.87, rcy + rr * 0.5]], {
    strokeColor: T.purple, strokeStyle: "dotted",
  });
  text(rcx - 46, rcy - 6, "ring composition", { fontSize: 9, strokeColor: T.purple });
  text(x + 12, y + 218, "12 mirrored movements. Ayah 4 (the dream)\nanswers ayah 100 (the dream fulfilled).", {
    fontSize: 10, strokeColor: T.sec,
  });
  y += 268;

  // macro tabs
  let mx = x;
  ["Story", "Themes", "Motifs", "Vocab"].forEach((c, i) => {
    mx += chip(mx, y, c, i === 0 ? { bg: T.purple, fg: T.white, strokeColor: T.purple } : {}) + 6;
  });
  y += 38;

  // ===== AYAH LIST =====
  text(x, y, "AYAT", { fontSize: 10, strokeColor: T.muted });
  text(x + w - 66, y, "12 / 111", { fontSize: 10, strokeColor: T.teal });
  y += 20;

  const ayat = [
    ["1", "Alif Lam Ra…", "strong", T.teal],
    ["2", "Innaa anzalnaahu…", "strong", T.teal],
    ["3", "Nahnu naqussu…", "due", T.coral],
    ["4", "Idh qaala Yusufu…", "learning", T.amber],
    ["5", "Qaala yaa bunayya…", "new", T.muted],
  ];
  ayat.forEach(([n, s, st, col]) => {
    rect(x, y, w, 46, { strokeColor: T.border });
    ellipse(x + 10, y + 13, 20, 20, { strokeColor: col });
    text(x + 16, y + 17, n, { fontSize: 10, strokeColor: col });
    text(x + 40, y + 9, s, { fontSize: 11 });
    text(x + 40, y + 27, st, { fontSize: 9, strokeColor: col });
    text(x + w - 20, y + 16, "›", { fontSize: 14, strokeColor: T.muted });
    y += 52;
  });
  text(x + w / 2 - 30, y + 4, "… 106 more", { fontSize: 10, strokeColor: T.muted });

  tabbar(p3, "Surah");
}

note(460, 1600, 350, "MACRO PANEL — persistent dashboard panel\n(your chosen placement)\n\nIt sits at the TOP of every surah page and\nstays there for the life of the surah. It is\nnot a gate and not a one-time tour — you\nre-read it every time you come back, and it\nfills in as you learn.\n\nThe ring dots light up teal as their ayat are\nmemorized, so the macro view IS the progress\nview. Macro and micro are the same picture at\ntwo zoom levels.", { h: 230, strokeColor: T.purple, bg: T.purpleBg, fg: "#332a66" });

note(460, 1860, 350, "WHY NOT A GATE?\nGating macro-before-micro sounds right but\npunishes returning users and adds a wall\nbefore the first win. Ambient beats\nmandatory: always visible, never blocking.\n\nIf you later want the stronger version, the\nmacro quiz (order the movements, match theme\nto ayah range) slots in as an optional\nchallenge card inside this same panel.", { h: 180 });

note(460, 2070, 350, "The 'Vocab' tab is the bridge to your\nrecommender: it shows which words in this\nsurah you already know from other surahs.\nThat same overlap score is what ranks\nrecommendations on the dashboard.", { h: 110, strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

// ============================================================
// 4 · AYAH DETAIL
// ============================================================
sectionTitle(880, 1440, "4", "Ayah detail", "The bridge between macro and drill.");

const p4 = phone(920, 1580, "Ayah detail", "route: /surah/[id]/ayah/[n]", { h: 620 });
{
  const { x, w } = p4.inner;
  let y = p4.y + 46;

  text(x, y, "‹  Yusuf · Ayah 4", { fontSize: 12, strokeColor: T.sec });
  y += 30;

  // position in macro
  rect(x, y, w, 44, { strokeColor: T.purple, backgroundColor: T.purpleBg, fillStyle: "solid" });
  text(x + 10, y + 8, "Movement 1 · The Dream", { fontSize: 10, strokeColor: "#332a66" });
  text(x + 10, y + 25, "mirrors ayah 100 — the dream fulfilled", { fontSize: 9, strokeColor: T.sec });
  y += 60;

  // the ayah — Amiri, largest type on screen (locked rule)
  rect(x, y, w, 92, { strokeColor: T.border, backgroundColor: T.surface, fillStyle: "solid" });
  text(x + 14, y + 22, "﴿ ٱلْأَيَة بِخَطِّ أَمِيرِي ﴾", { fontSize: 22, strokeColor: T.ink });
  text(x + 14, y + 60, "the verse is always the largest type", { fontSize: 9, strokeColor: T.muted });
  y += 108;

  text(x, y, "\"When Yusuf said to his father: O my father,\nI saw eleven stars…\"", {
    fontSize: 11, strokeColor: T.sec,
  });
  y += 46;

  // word-by-word
  text(x, y, "WORD BY WORD", { fontSize: 10, strokeColor: T.muted });
  y += 20;
  let wx = x;
  ["إِذْ", "قَالَ", "يُوسُفُ", "لِأَبِيهِ"].forEach((wd) => {
    const ww = 58;
    rect(wx, y, ww, 42, { strokeColor: T.border });
    text(wx + 10, y + 8, wd, { fontSize: 13 });
    text(wx + 8, y + 27, "gloss", { fontSize: 8, strokeColor: T.muted });
    wx += ww + 6;
  });
  y += 60;

  // strength
  text(x, y, "YOUR MEMORY OF THIS AYAH", { fontSize: 10, strokeColor: T.muted });
  y += 20;
  rect(x, y, w, 10, { strokeColor: T.border, sharp: true });
  rect(x, y, w * 0.45, 10, { strokeColor: T.amber, backgroundColor: T.amber, fillStyle: "solid", sharp: true });
  text(x, y + 18, "learning · next review tomorrow", { fontSize: 10, strokeColor: T.sec });
  y += 48;

  btn(x, y, w, 44, "Drill this ayah", { bg: T.ink });
  y += 54;
  btn(x, y, w, 36, "Listen", { bg: T.transparent, fg: T.ink, strokeColor: T.ink });
}

note(1260, 1600, 330, "Every ayah screen re-states WHERE IT SITS in\nthe macro structure (the purple strip).\n\nThat single line is what makes macro\nunderstanding stick — the learner meets it\nagain at every micro step, not once at the\nstart. Repetition of context, not a lecture.", { h: 140, strokeColor: T.purple, bg: T.purpleBg, fg: "#332a66" });

note(1260, 1770, 330, "'Drill this ayah' is the ONLY route into the\nquiz from here. Sessions are always assembled\nby the scheduler — the learner picks the\nsurah, never the individual question.\n\n(Carried over from v2: the app picks the next\ncard, not the user.)", { h: 140 });

// ============================================================
// 5 · THE QUIZ LOOP
// ============================================================
sectionTitle(80, 2440, "5", "The quiz loop", "Tap-to-reconstruct. Per ayah. The chaining problem lives here.");

// 5a — quiz card
const p5 = phone(120, 2580, "Quiz — tap to reconstruct", "route: /quiz/[sessionId]", { h: 600 });
{
  const { x, w } = p5.inner;
  let y = p5.y + 40;

  // progress
  rect(x, y, w, 6, { strokeColor: T.border, sharp: true });
  rect(x, y, w * 0.35, 6, { strokeColor: T.teal, backgroundColor: T.teal, fillStyle: "solid", sharp: true });
  text(x, y + 14, "3 / 9", { fontSize: 10, strokeColor: T.muted });
  text(x + w - 66, y + 14, "Yusuf 4", { fontSize: 10, strokeColor: T.muted });
  y += 44;

  text(x, y, "Rebuild the ayah", { fontSize: 13 });
  y += 30;

  // the ayah with blanks
  rect(x, y, w, 118, { strokeColor: T.border, backgroundColor: T.surface, fillStyle: "solid" });
  let bx = x + 12, by = y + 16;
  const slots = [["إِذْ", 1], ["____", 0], ["يُوسُفُ", 1], ["____", 0], ["رَبِّ", 1]];
  slots.forEach(([wd, filled]) => {
    const ww = 56;
    if (bx + ww > x + w - 12) { bx = x + 12; by += 44; }
    rect(bx, by, ww, 34, {
      strokeColor: filled ? T.border : T.teal,
      backgroundColor: filled ? T.white : T.tealBg,
      fillStyle: "solid",
      strokeStyle: filled ? "solid" : "dashed",
    });
    text(bx + 12, by + 8, wd, { fontSize: 13, strokeColor: filled ? T.ink : T.teal });
    bx += ww + 6;
  });
  y += 136;

  // word bank
  text(x, y, "TAP THE MISSING WORDS", { fontSize: 10, strokeColor: T.muted });
  y += 20;
  const bank = ["قَالَ", "لِأَبِيهِ", "قَالُوا", "لِأَخِيهِ", "يَا أَبَتِ", "رَأَيْتُ"];
  let kx = x, ky = y;
  bank.forEach((wd) => {
    const ww = 82;
    if (kx + ww > x + w) { kx = x; ky += 44; }
    rect(kx, ky, ww, 38, { strokeColor: T.ink, backgroundColor: T.white, fillStyle: "solid" });
    text(kx + 14, ky + 11, wd, { fontSize: 12 });
    kx += ww + 6;
  });
  y = ky + 56;

  text(x, y, "distractors are near-misses:\nsame root, same rhythm, wrong verse", { fontSize: 10, strokeColor: T.muted });
  y += 40;
  btn(x, y, w, 40, "Check", { bg: T.ink });
}

// 5b — chaining
const p6 = phone(500, 2580, "Chaining", "the tricky part — solved", { h: 600 });
{
  const { x, w } = p6.inner;
  let y = p6.y + 40;

  rect(x, y, w, 6, { strokeColor: T.border, sharp: true });
  rect(x, y, w * 0.8, 6, { strokeColor: T.coral, backgroundColor: T.coral, fillStyle: "solid", sharp: true });
  y += 30;

  rect(x, y, w, 26, { strokeColor: T.coral, backgroundColor: T.coralBg, fillStyle: "solid" });
  text(x + 10, y + 6, "CHAIN CHECK · ayah 3 → 4", { fontSize: 10, strokeColor: "#712b13" });
  y += 42;

  text(x, y, "You just recited:", { fontSize: 11, strokeColor: T.sec });
  y += 22;
  rect(x, y, w, 52, { strokeColor: T.border, backgroundColor: T.surface, fillStyle: "solid" });
  text(x + 12, y + 14, "…وَإِن كُنتَ مِن قَبْلِهِ", { fontSize: 15, strokeColor: T.muted });
  text(x + 12, y + 36, "ayah 3, last words", { fontSize: 9, strokeColor: T.muted });
  y += 70;

  text(x, y, "What comes next?", { fontSize: 13 });
  y += 30;

  ["إِذْ قَالَ يُوسُفُ", "قَالَ يَا بُنَيَّ", "وَكَذَٰلِكَ يَجْتَبِيكَ"].forEach((opt, i) => {
    rect(x, y, w, 46, {
      strokeColor: i === 0 ? T.teal : T.ink,
      backgroundColor: i === 0 ? T.tealBg : T.white,
      fillStyle: "solid",
      strokeWidth: i === 0 ? 2 : 1,
    });
    text(x + 14, y + 14, opt, { fontSize: 13 });
    y += 54;
  });

  y += 8;
  text(x, y, "Chains are their own card type,\nscheduled separately from ayat.", { fontSize: 10, strokeColor: T.sec });
}

// 5c — feedback / summary
const p7 = phone(880, 2580, "Session summary", "route: /quiz/[id]/summary", { h: 600 });
{
  const { x, w } = p7.inner;
  let y = p7.y + 50;

  ellipse(x + w / 2 - 34, y, 68, 68, { strokeColor: T.teal, backgroundColor: T.tealBg, fillStyle: "solid" });
  text(x + w / 2 - 12, y + 24, "✓", { fontSize: 26, strokeColor: T.teal });
  y += 92;

  text(x + w / 2 - 52, y, "Session complete", { fontSize: 16 });
  y += 32;
  text(x + w / 2 - 74, y, "9 recalls · 7 clean · 6 min", { fontSize: 11, strokeColor: T.muted });
  y += 42;

  [
    ["Ayah 4", "now learning", T.amber],
    ["Ayah 3", "strengthened", T.teal],
    ["Chain 3→4", "needs work", T.coral],
  ].forEach(([n, s, col]) => {
    rect(x, y, w, 44, { strokeColor: T.border });
    text(x + 12, y + 9, n, { fontSize: 12 });
    text(x + 12, y + 27, s, { fontSize: 10, strokeColor: col });
    y += 52;
  });

  y += 14;
  rect(x, y, w, 62, { strokeColor: T.purple, backgroundColor: T.purpleBg, fillStyle: "solid" });
  text(x + 12, y + 11, "You finished Movement 1", { fontSize: 12, strokeColor: "#332a66" });
  text(x + 12, y + 31, "The Dream. Its mirror, ayah 100,\nunlocks much later.", { fontSize: 10, strokeColor: T.sec });
  y += 80;

  btn(x, y, w, 42, "Done", { bg: T.ink });
}

note(1260, 2600, 330, "THE CHAINING PROBLEM — you flagged this as\nthe trickiest part. It is, and the fix is to\nstop treating it as a property of ayat.\n\nA chain is a SEPARATE MEMORY OBJECT: the\njoint between ayah N and N+1, with its own\nstrength and its own review schedule.\n\nWhy this works: reciting ayah 3 perfectly and\nayah 4 perfectly does NOT mean you can go\nfrom 3 into 4 — the transition is a distinct\nretrieval. Most hifz apps miss this and\nlearners stall at exactly these joints.", { h: 230, strokeColor: T.coral, bg: T.coralBg, fg: "#712b13" });

note(1260, 2860, 330, "A chain card only becomes eligible once BOTH\nits ayat are individually strong. Otherwise\nyou are testing a joint between two things\nthat do not yet exist.\n\nv2 already has this in engine/chain.ts —\nincluding BUG-3 (chains crediting un-learned\nayat), which v3 should inherit ALREADY FIXED.", { h: 150 });

// ============================================================
// 6 · THE CHAIN MODEL — diagram
// ============================================================
sectionTitle(80, 3320, "6", "The chain model", "How Surah → Ayah → Quiz actually decomposes.");

{
  const y0 = 3440;
  // surah
  rect(80, y0, 200, 60, { strokeColor: T.ink, strokeWidth: 2, backgroundColor: T.white, fillStyle: "solid" });
  text(96, y0 + 14, "SURAH", { fontSize: 15 });
  text(96, y0 + 36, "macro panel · ring", { fontSize: 10, strokeColor: T.muted });

  // ayat
  const ax = 400;
  for (let i = 0; i < 4; i++) {
    const yy = y0 - 90 + i * 76;
    rect(ax, yy, 150, 54, { strokeColor: T.teal, backgroundColor: T.tealBg, fillStyle: "solid" });
    text(ax + 14, yy + 10, `Ayah ${i + 1}`, { fontSize: 13, strokeColor: "#085041" });
    text(ax + 14, yy + 30, "atoms: words", { fontSize: 9, strokeColor: T.sec });
    arrow([[280, y0 + 30], [340, yy + 27], [ax, yy + 27]], { strokeColor: T.border });

    // chain between consecutive ayat
    if (i < 3) {
      const cy = yy + 54;
      rect(ax + 30, cy + 6, 90, 22, {
        strokeColor: T.coral, backgroundColor: T.coralBg, fillStyle: "solid", strokeStyle: "dashed",
      });
      text(ax + 38, cy + 11, `chain ${i + 1}→${i + 2}`, { fontSize: 9, strokeColor: "#712b13" });
    }
  }

  // quiz items
  const qx = 700;
  const kinds = [
    ["Reconstruct", "tap words back into place", T.teal],
    ["Recall cold", "produce with no support", T.teal],
    ["Chain", "N → N+1 transition", T.coral],
    ["Meaning", "gloss ↔ word", T.purple],
  ];
  kinds.forEach(([n, s, col], i) => {
    const yy = y0 - 90 + i * 76;
    rect(qx, yy, 200, 54, { strokeColor: col, backgroundColor: T.white, fillStyle: "solid" });
    text(qx + 14, yy + 10, n, { fontSize: 13, strokeColor: col });
    text(qx + 14, yy + 30, s, { fontSize: 9, strokeColor: T.muted });
  });
  arrow([[550, y0 + 30], [660, y0 + 30], [660, y0 - 60], [qx, y0 - 60]], { strokeColor: T.border });
  text(578, y0 + 40, "each produces", { fontSize: 10, strokeColor: T.muted });

  // scheduler
  rect(990, y0 - 90, 210, 274, {
    strokeColor: T.ink, backgroundColor: T.surface, fillStyle: "solid", strokeWidth: 2,
  });
  text(1006, y0 - 74, "SCHEDULER", { fontSize: 14 });
  text(1006, y0 - 50, "every item above is a\ncard with independent\nstrength + due date.\n\nThe scheduler assembles\ntoday's session:\n\n  make-up → chain →\n  review → learn\n\nThe learner never picks\nthe question.", {
    fontSize: 10, strokeColor: T.sec,
  });
  arrow([[900, y0 + 40], [990, y0 + 40]], { strokeColor: T.border });

  note(1260, y0 - 90, 330, "This decomposition is why 'quiz per ayah' is\nnot quite the right frame.\n\nThe unit of SCHEDULING is the card, and cards\nlive at three levels: word (atom), ayah, and\nchain (the joint). A 'quiz' is just today's\nassembled mix across all three.\n\nSurah → Ayah → Quiz is the NAVIGATION\nhierarchy. The memory model underneath is a\ngraph, not a tree.", { h: 200, strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });
}

// ============================================================
// 7 · TRACKING — the event pipeline
// ============================================================
sectionTitle(80, 3820, "7", "Tracking", "What gets recorded, and why the log is the truth.");

{
  const y0 = 3930;

  // --- the pipeline ---
  const stages = [
    ["Learner taps", "one word placed", T.ink, T.white],
    ["makeEvent()", "pure constructor,\nno IO", T.ink, T.white],
    ["append() → IndexedDB", "AWAITS tx.done\nBEFORE any UI feedback", T.teal, T.tealBg],
    ["UI animates", "only after durable commit", T.ink, T.white],
  ];
  stages.forEach(([t, s, col, bg], i) => {
    const x = 80 + i * 250;
    rect(x, y0, 200, 76, { strokeColor: col, backgroundColor: bg, fillStyle: "solid", strokeWidth: i === 2 ? 2 : 1 });
    text(x + 12, y0 + 12, t, { fontSize: 13, strokeColor: col });
    text(x + 12, y0 + 34, s, { fontSize: 10, strokeColor: T.sec });
    if (i < stages.length - 1) arrow([[x + 200, y0 + 38], [x + 250, y0 + 38]], { strokeColor: T.border });
  });

  note(1090, y0 - 12, 340, "INVARIANT #2 — events are TRUTH.\nEvery tap commits to IndexedDB before the UI\nreacts. `append()` resolves only after the\ntransaction durably completes, so a crash\nmid-session loses nothing.\n\nA wedged IndexedDB can never hang the app —\nreads are wrapped in a timeout.", { h: 150, strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

  // --- event taxonomy ---
  const ey = y0 + 130;
  text(80, ey, "THE 19 EVENT TYPES — grouped by what they move", { fontSize: 14 });

  const groups = [
    ["GRADED — move strength", T.teal, [
      "tap · reconstruct_tap", "rung_complete · ayah_produced",
      "gate_result · gate_demote", "junction_result · chain_step", "connection_born",
    ]],
    ["EVIDENCE ONLY — no strength", T.muted, [
      "rung_start · ayah_complete", "session_start", "interruption",
      "placement_probe · placement_result", "adoption",
    ]],
    ["READ-ONLY MIRROR — never folded", T.coral, [
      "test_start", "test_answer", "test_result",
      "", "(a Test grades you without", "moving any due-date — v2-D14)",
    ]],
  ];
  groups.forEach(([title, col, items], gi) => {
    const x = 80 + gi * 340;
    const h = 34 + items.length * 20;
    rect(x, ey + 26, 310, h, { strokeColor: col, backgroundColor: T.white, fillStyle: "solid" });
    text(x + 12, ey + 38, title, { fontSize: 11, strokeColor: col });
    items.forEach((it, i) => {
      if (it) text(x + 12, ey + 60 + i * 20, "· " + it, { fontSize: 10, strokeColor: T.sec });
    });
  });

  note(1090, ey + 26, 340, "WHY THREE TIERS?\nThe read-only tier is the subtle one. A Test\nis a MIRROR: it generates and grades real\nquestions, but rebuild.ts has no branch for\nit at all — so it cannot move strength or\ndue-dates.\n\nThis lets a learner self-assess whenever they\nlike WITHOUT corrupting the schedule. Testing\nyourself is not the same as being tested.", { h: 180, strokeColor: T.coral, bg: T.coralBg, fg: "#712b13" });

  // --- sync ---
  const sy = ey + 240;
  rect(80, sy, 300, 92, { strokeColor: T.ink, backgroundColor: T.white, fillStyle: "solid" });
  text(94, sy + 12, "LOCAL — IndexedDB", { fontSize: 12 });
  text(94, sy + 32, "append-only · monotonic seq\nstable uuid per event\nsynced: 0 | 1", { fontSize: 10, strokeColor: T.sec });

  rect(480, sy, 300, 92, { strokeColor: T.ink, backgroundColor: T.white, fillStyle: "solid" });
  text(494, sy + 12, "OUTBOX → Laravel /events", { fontSize: 12 });
  text(494, sy + 32, "batches of 200 · Bearer token\nidempotent by client uuid\noffline → stops quietly, retries", { fontSize: 10, strokeColor: T.sec });

  arrow([[380, sy + 46], [480, sy + 46]], { strokeColor: T.teal });
  text(392, sy + 26, "best-effort", { fontSize: 9, strokeColor: T.teal });

  note(1090, sy - 6, 340, "Sync is BEST-EFFORT and never blocks. The\nlocal commit already happened; the outbox is\npure background push.\n\nIdempotency comes from the client-stamped\nuuid, so replaying a batch is safe — the\nserver dedupes. This is what makes 'created\noffline, syncs on reconnect' work without a\nconflict-resolution layer.", { h: 200 });
}

// ============================================================
// 8 · SCHEDULING — atoms, bands, the queue
// ============================================================
sectionTitle(80, 4560, "8", "Scheduling", "The atom, its strength band, and how a session is assembled.");

{
  const y0 = 4680;

  // --- the atom ---
  rect(80, y0, 330, 250, { strokeColor: T.ink, strokeWidth: 2, backgroundColor: T.white, fillStyle: "solid" });
  text(96, y0 + 14, "AtomState — the scheduled unit", { fontSize: 14 });
  text(96, y0 + 38, "kind: 'ayah' | 'connection'", { fontSize: 11, strokeColor: T.teal });
  const fields = [
    ["strength", "0–100, the band value"],
    ["stability", "FSRS-shaped, in learning-days"],
    ["difficulty", "0–1, nudged by outcomes"],
    ["lastRetrieval", "ms, or null if never"],
    ["reps / lapses", "counters"],
    ["encoded", "produced whole at least once"],
    ["gateDueAt / gatePassed", "the day-1 cold gate"],
    ["gateFails", "forgiveness ladder counter"],
  ];
  fields.forEach(([f, d], i) => {
    text(96, y0 + 62 + i * 23, f, { fontSize: 11 });
    text(230, y0 + 62 + i * 23, d, { fontSize: 9, strokeColor: T.muted });
  });

  note(80, y0 + 266, 330, "≤ 221 atoms per learner for Yusuf:\n111 ayat + 110 connections.\n\nNEVER per-word. Word taps are EVIDENCE that\nrolls up to the ayah atom — that is what keeps\nthe scheduler tractable at surah scale.", { h: 118, strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

  // --- the bands ---
  const bx = 470;
  text(bx, y0 - 6, "STRENGTH BANDS — the stage IS the band", { fontSize: 13 });
  const bands = [
    ["lapsed", "< 0", T.coral],
    ["learn", "0 – 39", T.amber],
    ["reinforce", "40 – 79", T.teal],
    ["carry", "80 – 100", "#085041"],
  ];
  bands.forEach(([n, r, col], i) => {
    const yy = y0 + 20 + i * 54;
    rect(bx, yy, 250, 44, { strokeColor: col, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
    text(bx + 14, yy + 8, n, { fontSize: 13, strokeColor: col });
    text(bx + 14, yy + 26, r, { fontSize: 10, strokeColor: T.muted });
  });

  // decay curve
  const cx = 470, cy = y0 + 260;
  text(cx, cy - 16, "DECAY — retrievability = exp(−Δt / stability)", { fontSize: 12 });
  rect(cx, cy, 250, 110, { strokeColor: T.border, backgroundColor: T.white, fillStyle: "solid" });
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    pts.push([cx + 10 + t * 230, cy + 12 + (1 - Math.exp(-t * 3)) * 84]);
  }
  line(pts, { strokeColor: T.coral, strokeWidth: 2 });
  text(cx + 14, cy + 92, "time since last retrieval →", { fontSize: 9, strokeColor: T.muted });
  text(cx + 190, cy + 14, "forgotten", { fontSize: 9, strokeColor: T.coral });

  // --- the queue ---
  const qx = 800;
  text(qx, y0 - 6, "assembleQueue() — FIXED ORDER", { fontSize: 13 });
  const q = [
    ["1  MAKE-UP", "only after a SKIPPED day (gap ≥ 2)", T.coral],
    ["2  GATES", "day-1 cold checks now due", T.amber],
    ["3  REVIEWS", "ranked by forgetting-risk × weight\nconnections weighted ×1.5", T.teal],
    ["4  LEARN", "new ayah — only if unlockPermitted", T.purple],
  ];
  q.forEach(([n, s, col], i) => {
    const yy = y0 + 20 + i * 74;
    rect(qx, yy, 300, 62, { strokeColor: col, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
    text(qx + 14, yy + 10, n, { fontSize: 13, strokeColor: col });
    text(qx + 14, yy + 30, s, { fontSize: 10, strokeColor: T.sec });
    if (i < 3) arrow([[qx + 150, yy + 62], [qx + 150, yy + 74]], { strokeColor: T.border });
  });

  note(qx, y0 + 316, 300, "Time budget (~6–8 min) TRIMS the queue —\nbut gates and make-ups are NEVER dropped.\nThey define the minimum viable session, so a\nsession is always finishable.", { h: 100, strokeColor: T.amber, bg: T.amberBg, fg: "#7a4d0d" });

  note(1150, y0 - 20, 340, "THE COLD GATE is the spine of the schedule.\n\nProduce an ayah whole (S3) → a gate is armed\nfor the NEXT learning-day. 'Cold' = first\nattempt of a fresh day, no warm-up.\n\nA new ayah unlocks only when yesterday's\nencodings pass their gate. That single rule\nis what stops a learner racing ahead and\ncollecting ayat they cannot hold.\n\nTolerance band (v2-D07): Sprint allows 1\npending gate; Steady/Maintain are strict.", { h: 230, strokeColor: T.purple, bg: T.purpleBg, fg: "#332a66" });

  note(1150, y0 + 230, 340, "FORGIVENESS LADDER (v2-D08)\nA failed gate re-arms for the next day and\nincrements gateFails. After repeated fails\nthe app OFFERS to send the ayah back to\nLearn — the learner accepts, it is never\nforced.\n\nPost-lapse stability is DAMPED (×0.4), never\nzeroed. Sabr jameel: losing a week of work to\none bad morning is the thing that makes\npeople quit.", { h: 200, strokeColor: T.coral, bg: T.coralBg, fg: "#712b13" });
}

// ============================================================
// 9 · THE FIVE INVARIANTS
// ============================================================
sectionTitle(80, 5320, "9", "The five locked invariants", "Rules the scheduler may never break. Inherited from v2.");

{
  const y0 = 5430;
  const inv = [
    ["#1", "The atom is the AYAH", "Never per-word. Word taps roll up.\n≤221 atoms/learner keeps it tractable.", T.teal],
    ["#2", "The event log is TRUTH", "`atoms` is a rebuildable cache.\nrebuild() folds events → state. Always.", T.teal],
    ["#3", "First-pass meaning errors are PRETEST", "Excluded from strength entirely.\nYou cannot fail at something\nnobody taught you yet.", T.purple],
    ["#4", "Evidence asymmetry", "Errors carry FULL weight.\nMassed same-day successes damped ×0.35.\nSpacing measured between RETRIEVALS,\nnever app-opens.", T.amber],
    ["#5", "Only STRUCTURED sessions mutate", "Free-play is recorded as evidence\nbut moves no strength. Playing around\ncannot corrupt your schedule.", T.coral],
  ];
  inv.forEach(([n, t, s, col], i) => {
    const x = 80 + (i % 3) * 460;
    const yy = y0 + Math.floor(i / 3) * 190;
    rect(x, yy, 430, 165, { strokeColor: col, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
    text(x + 16, yy + 14, n, { fontSize: 26, strokeColor: col, opacity: 60 });
    text(x + 62, yy + 20, t, { fontSize: 15 });
    text(x + 16, yy + 62, s, { fontSize: 11, strokeColor: T.sec });
  });

  note(1000, y0 + 190, 430, "INVARIANT #4 IS THE MOST IMPORTANT ONE.\n\n'Spacing measured between retrievals, never\napp-opens' is what separates an honest SRS\nfrom a streak-farming app. Opening the app is\nnot learning. Only a graded retrieval moves\nthe clock.\n\nAnd damping massed successes ×0.35 means\ncramming the same ayah ten times in one\nsitting is worth roughly three spaced reps —\nnot ten. The engine refuses to be gamed.", { h: 215, strokeColor: T.amber, bg: T.amberBg, fg: "#7a4d0d" });
}

// ============================================================
// 10 · RETENTION MONITORING — the learner-facing surface
// ============================================================
sectionTitle(80, 5900, "10", "Retention monitoring", "Making decay visible — honestly.");

const p8 = phone(120, 6040, "Progress", "route: /progress", { h: 700 });
{
  const { x, w } = p8.inner;
  let y = p8.y + 46;

  text(x, y, "Your memory", { fontSize: 17 });
  text(x, y + 24, "Surah Yusuf · 12 ayat carried", { fontSize: 10, strokeColor: T.muted });
  y += 52;

  // headline metric
  rect(x, y, w, 74, { strokeColor: T.teal, backgroundColor: T.tealBg, fillStyle: "solid", strokeWidth: 2 });
  text(x + 14, y + 12, "HALF-LIFE", { fontSize: 10, strokeColor: "#085041" });
  text(x + 14, y + 30, "9.4 days", { fontSize: 22, strokeColor: "#085041" });
  text(x + 14, y + 56, "before you'd forget half, unreviewed", { fontSize: 9, strokeColor: T.sec });
  chip(x + w - 34, y + 12, "?", { fontSize: 10, w: 22, strokeColor: T.teal, fg: T.teal });
  y += 94;

  // decay-visible
  text(x, y, "DECAY SINCE YOU LAST SAW IT", { fontSize: 10, strokeColor: T.muted });
  y += 22;
  [
    ["Ayah 3", "72% → 64%", "Thursday", T.coral],
    ["Ayah 7", "88% → 85%", "yesterday", T.amber],
    ["Chain 9→10", "61% → 48%", "5 days ago", T.coral],
  ].forEach(([n, d, s, col]) => {
    rect(x, y, w, 48, { strokeColor: T.border });
    text(x + 12, y + 9, n, { fontSize: 12 });
    text(x + 12, y + 28, d + "  ·  " + s, { fontSize: 10, strokeColor: col });
    y += 56;
  });

  y += 8;
  // band distribution
  text(x, y, "WHERE YOUR AYAT SIT", { fontSize: 10, strokeColor: T.muted });
  y += 22;
  const dist = [["carry", 0.42, "#085041"], ["reinforce", 0.33, T.teal], ["learn", 0.17, T.amber], ["lapsed", 0.08, T.coral]];
  let sx = x;
  dist.forEach(([n, f, col]) => {
    const ww = w * f;
    rect(sx, y, ww, 26, { strokeColor: col, backgroundColor: col, fillStyle: "solid", sharp: true });
    sx += ww;
  });
  y += 34;
  dist.forEach(([n, f, col], i) => {
    text(x + (i % 2) * 140, y + Math.floor(i / 2) * 18, `■ ${n} ${Math.round(f * 100)}%`, {
      fontSize: 9, strokeColor: col,
    });
  });
  y += 52;

  // honesty banner
  rect(x, y, w, 66, { strokeColor: T.purple, backgroundColor: T.purpleBg, fillStyle: "solid" });
  text(x + 12, y + 11, "3 ayat are slipping", { fontSize: 12, strokeColor: "#332a66" });
  text(x + 12, y + 30, "Not a failure — this is what\nmemory does. Review takes 4 min.", { fontSize: 10, strokeColor: T.sec });

  tabbar(p8, "Progress");
}

note(460, 6060, 350, "RETENTION HONESTY — the anti-pattern guard\n\nThe numbers shown here are the SAME numbers\nthe scheduler uses. `decaySince()` and\n`halfLifeDays()` read straight off the atom's\nstability. Nothing is decorative.\n\nThis is deliberate: an app that shows a\nlearner a green dashboard while its own\nscheduler thinks they are lapsing has lied to\nthem. Retention is the product — so the\nretention numbers must be the real ones.", { h: 210, strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

note(460, 6290, 350, "WHAT IS DELIBERATELY *NOT* HERE\n  · no streak counter as the hero metric\n  · no 'you're 97% done!' when 3 ayat lapsed\n  · no guilt copy on a missed day\n  · no leaderboard\n\nThe streak exists (streak.ts) but it is never\nthe headline. Half-life is. The question the\napp answers is 'will I still know this in a\nyear', not 'did I open the app today'.", { h: 180, strokeColor: T.coral, bg: T.coralBg, fg: "#712b13" });

note(460, 6490, 350, "TARGET METRIC (from tiktok-discussion.md)\n  P(recalled in 10 years) — NOT DAU.\n  'Maximize successful retrievals per minute.'\n\nThe event log is what makes this measurable\nlater: every graded retrieval is labelled,\ntimestamped, and attributable to an atom. That\ndataset is the moat, not the quiz UI.", { h: 150, strokeColor: T.purple, bg: T.purpleBg, fg: "#332a66" });

note(840, 6060, 340, "MULTI-SURAH CHANGES THE MONITORING\nThis is the one place v3 genuinely extends v2\nrather than porting it.\n\nWith N surahs there are N independent decay\ncurves competing for one daily budget. The\nProgress page needs a per-surah breakdown AND\na combined load view — otherwise a learner\nadds a third surah and silently starves the\nfirst two.\n\nThe dashboard's 'Add' confirm (§2) is the\nplace to surface that cost BEFORE they commit.", { h: 210, strokeColor: T.amber, bg: T.amberBg, fg: "#7a4d0d" });

note(840, 6290, 340, "SERVER-SIDE MONITORING (Laravel)\nOnce events sync, the same fold runs\nserver-side for:\n  · cohort retention curves\n  · which distractors mislead most\n  · where learners stall (expect: chains)\n  · FSRS calibration — predicted vs actual\n\nNone of it needs new instrumentation. It is\nthe same 19 events, folded differently.", { h: 165 });

// ============================================================
// 11 · EDGE CASES — where multi-surah breaks the v2 engine
// ============================================================
sectionTitle(80, 6820, "11", "Edge cases · multi-surah", "Ported code that is CORRECT for one surah and WRONG for many.");

{
  const y0 = 6940;

  // --- THE BLOCKER ---
  rect(80, y0, 1350, 200, {
    strokeColor: T.coral, backgroundColor: T.coralBg, fillStyle: "solid", strokeWidth: 3,
  });
  text(100, y0 + 16, "E-01  ATOM KEY COLLISION — hard blocker, fix before ANY second surah exists", {
    fontSize: 18, strokeColor: "#712b13",
  });
  text(100, y0 + 48, "atomKey(kind, ref) = `${kind}:${ref}`  —  engine/src/atom.ts:69.  AtomState has NO surah field.\nrebuildAtoms() reads EVERY event (db/atoms.ts) and folds them into ONE map. rebuild() never reads e.surah.", {
    fontSize: 13, strokeColor: T.ink,
  });
  text(100, y0 + 100, "⇒ Yusuf ayah 5 and Al-Mulk ayah 5 are THE SAME ATOM.", { fontSize: 15, strokeColor: T.coral });
  text(100, y0 + 126, "Reviewing one credits the other. Strength, gates and due-dates all silently merge.\nInvisible in v2 because v2 ships one surah. The event log already carries `surah` — only the FOLD is blind.", {
    fontSize: 12, strokeColor: T.sec,
  });
  text(100, y0 + 172, "FIX: surah rides the key → `${surah}:${kind}:${ref}`, plus a `surah` field on AtomState. Do it in the port (step 4), not later —\nonce a learner has two surahs of history, a corrupted log cannot be un-merged by replaying it.", {
    fontSize: 12, strokeColor: "#712b13",
  });

  // --- the rest ---
  const cases = [
    ["E-02", "One budget, N decay curves", T.coral,
      "assembleQueue() takes ONE atoms array and ONE\nbudgetMin. With 3 surahs it either starves two of\nthem or triples the session silently.",
      "Assemble PER SURAH, then merge under a single\nglobal budget. Allocation rule must be explicit:\nrecommend risk-weighted (highest forgetting-risk\nfirst, across all surahs) — never round-robin."],
    ["E-03", "unlockPermitted() spans surahs", T.coral,
      "It filters `atoms` for pending gates with no surah\nnotion. A pending gate in Al-Mulk therefore BLOCKS\nnew learning in Yusuf.",
      "Scope the gate check to the surah being learned.\nCross-surah blocking is never what the learner\nmeant, and it is invisible when it happens."],
    ["E-04", "Streak is global; surahs are not", T.amber,
      "computeStreak() folds completed-day indices across\nevery event. Finishing Al-Mulk keeps the streak\nalive while Yusuf silently rots for weeks.",
      "Keep ONE global streak (it is a habit metric, not\na mastery metric) but never let it imply per-surah\nhealth. §10's per-surah decay is the honest view."],
    ["E-05", "Pace mode is per-learner, not per-surah", T.amber,
      "paceConfig() returns one budgetMin + newAyahCeiling.\nA learner sprinting Al-Mulk while maintaining Yusuf\nhas no way to say so.",
      "Make pace PER SURAH (steady/sprint/maintain each),\nwith the global budget as the ceiling. 'Maintain'\nbecomes the natural parking state for surah #1."],
    ["E-06", "planFor() assumes one surah's remainder", T.amber,
      "etaDays is computed from one surah's remainingAyat\nand the FULL daily budget — so every surah's ETA\nclaims the whole day. Three surahs ⇒ three lies.",
      "ETA must divide the budget by active surahs. This\nis exactly the number the library's 'Add' confirm\nneeds (§2) — show the RE-COMPUTED ETA of existing\nsurahs, not just the new one's."],
    ["E-07", "Corpus fetch is per-surah and unguarded", T.teal,
      "loadCorpus(surah) fetches /corpus/{n}.json with no\ncache. N surahs on the dashboard = N fetches on\nevery load; one 404 breaks the whole page.",
      "Cache per surah; render MY SURAHS from the event\nlog + a tiny manifest, and lazy-load full corpus\nonly on the surah page. A missing corpus must\ndegrade to a disabled row, not a dead dashboard."],
    ["E-08", "Chains must never cross a surah", T.purple,
      "chain.ts joins ayah n→n+1 by number. Nothing stops\na 'chain' from the last ayah of one surah to the\nfirst of another.",
      "Bound chains to [1, ayahCount] of their OWN surah.\nThe last ayah of every surah has no outbound chain\n— a real terminal case, not an error."],
  ];

  let cy = y0 + 230;
  cases.forEach(([code, title, col, problem, fix]) => {
    const h = 130;
    rect(80, cy, 1350, h, { strokeColor: col, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
    text(98, cy + 12, code, { fontSize: 15, strokeColor: col });
    text(160, cy + 12, title, { fontSize: 15 });
    text(98, cy + 42, "PROBLEM", { fontSize: 10, strokeColor: T.muted });
    text(98, cy + 60, problem, { fontSize: 11, strokeColor: T.sec });
    text(700, cy + 42, "FIX", { fontSize: 10, strokeColor: col });
    text(700, cy + 60, fix, { fontSize: 11, strokeColor: T.ink });
    line([[688, cy + 40], [688, cy + h - 12]], { strokeColor: T.border });
    cy += h + 14;
  });
}

// ============================================================
// 12 · EDGE CASES — learner-facing
// ============================================================
sectionTitle(80, 8320, "12", "Edge cases · learner-facing", "States the screens in §1–§5 must actually handle.");

{
  const y0 = 8440;
  const rows = [
    ["Zero state", "No surahs added yet.", "Dashboard has no 'Continue' CTA. Lead with the\nrecommender + library. Never an empty MY SURAHS box.", T.teal],
    ["Returning after weeks", "Everything is due at once.", "resumePolicy() → 'makeup'. Do NOT dump 40 items.\nCap the make-up queue, say what was deferred, and\nkeep the session finishable (§8's rule).", T.coral],
    ["All surahs finished", "Nothing left to learn.", "Maintain mode becomes the default; dashboard shows\nreviews only. The recommender's moment to shine.", T.purple],
    ["Surah completed mid-session", "Last ayah of Yusuf passes its gate.", "Celebrate at the SURAH level, not just the session.\nThis is the app's biggest emotional beat — §5's\nsummary needs a distinct completion state.", T.purple],
    ["Learner pauses a surah", "Explicit 'pause' on a row.", "Pause = stop scheduling NEW, keep reviews optional,\nfreeze nothing (decay is real and must stay honest).\nUnpausing shows the true decayed state, not the\nstate at pause time.", T.amber],
    ["Same ayah, two surahs", "Al-Fatihah 1 = Al-Kahf's basmala.", "Identical Arabic, different atoms. Do NOT dedupe —\nposition in the surah is part of what is memorized.", T.teal],
    ["Very short surah", "Al-Kawthar = 3 ayat.", "planFor() gives etaDays≈1 and there are only 2\nchains. The macro panel's ring is meaningless at\nn=3 → fall back to the flat 1→N grid (v2-D29).", T.amber],
    ["Device shared / reset", "resetForNewLearner() wipes local.", "With N surahs the confirm must name what is lost.\nOne generic 'reset' is far more destructive now.", T.coral],
    ["Clock / timezone shift", "Travel across the day boundary.", "daybound.ts uses local wall clock w/ 04:30 rollover.\nA westward flight can make daysBetween() return 0\nfor a real day — massed damping then wrongly applies.", T.muted],
    ["Offline for days", "Outbox grows unsynced.", "Local commit already happened, so learning is\nunaffected. Surface 'N events pending' quietly;\nnever block a session on sync.", T.teal],
  ];

  let cy = y0;
  rows.forEach(([t, when, then, col]) => {
    const h = String(then).split("\n").length * 15 + 44;
    rect(80, cy, 1350, h, { strokeColor: col, backgroundColor: T.white, fillStyle: "solid" });
    text(98, cy + 12, t, { fontSize: 14, strokeColor: col });
    text(98, cy + 34, when, { fontSize: 11, strokeColor: T.muted });
    text(470, cy + 12, then, { fontSize: 12, strokeColor: T.ink });
    line([[458, cy + 10], [458, cy + h - 10]], { strokeColor: T.border });
    cy += h + 12;
  });

  note(80, cy + 10, 700, "THE ONE THAT WILL BITE FIRST: E-01.\nEverything else degrades gracefully or is a UX gap. The atom-key collision silently\nCORRUPTS memory state, and it cannot be repaired after the fact by replaying the log —\nbecause the log's events were folded into merged atoms whose history is now ambiguous.\n\nIt costs ~20 lines to fix during the engine port. It costs a data migration afterwards.", { strokeColor: T.coral, bg: T.coralBg, fg: "#712b13" });
}

// ============================================================
// 13 · CONTINUOUS DRILL — range & page
// ============================================================
sectionTitle(80, 9560, "13", "Daily continuous drill", "Chain a chosen run of ayat, or a whole mushaf page, in one sitting.");

// 13a — the range picker
const p9 = phone(120, 9700, "Pick your run", "on /surah/[id]", { h: 640 });
{
  const { x, w } = p9.inner;
  let y = p9.y + 46;

  text(x, y, "Continuous drill", { fontSize: 16 });
  text(x, y + 22, "Recite a run end-to-end, junctions included.", { fontSize: 10, strokeColor: T.muted });
  y += 52;

  // unit toggle
  text(x, y, "UNIT", { fontSize: 10, strokeColor: T.muted });
  y += 20;
  let ux = x;
  [["Ayah range", true], ["Page", false]].forEach(([l, on]) => {
    ux += chip(ux, y, l, on
      ? { bg: T.ink, fg: T.white, strokeColor: T.ink, fontSize: 12, h: 30 }
      : { fontSize: 12, h: 30 }) + 8;
  });
  y += 46;

  // range sliders
  rect(x, y, w, 92, { strokeColor: T.border, backgroundColor: T.surface, fillStyle: "solid" });
  text(x + 12, y + 10, "From ayah", { fontSize: 10, strokeColor: T.muted });
  text(x + w - 46, y + 10, "4", { fontSize: 13, strokeColor: T.teal });
  rect(x + 12, y + 30, w - 24, 5, { strokeColor: T.border, sharp: true });
  ellipse(x + 12 + (w - 24) * 0.28, y + 26, 14, 14, { strokeColor: T.teal, backgroundColor: T.teal, fillStyle: "solid" });
  text(x + 12, y + 48, "To ayah", { fontSize: 10, strokeColor: T.muted });
  text(x + w - 46, y + 48, "9", { fontSize: 13, strokeColor: T.teal });
  rect(x + 12, y + 68, w - 24, 5, { strokeColor: T.border, sharp: true });
  ellipse(x + 12 + (w - 24) * 0.62, y + 64, 14, 14, { strokeColor: T.teal, backgroundColor: T.teal, fillStyle: "solid" });
  y += 108;

  // the resolved chain
  rect(x, y, w, 96, { strokeColor: T.coral, backgroundColor: T.coralBg, fillStyle: "solid", strokeWidth: 2 });
  text(x + 12, y + 10, "YOUR CHAIN — 11 steps", { fontSize: 10, strokeColor: "#712b13" });
  let sx2 = x + 12;
  for (let i = 0; i < 6; i++) {
    ellipse(sx2, y + 32, 18, 18, { strokeColor: T.coral, backgroundColor: T.white, fillStyle: "solid" });
    text(sx2 + 4, y + 36, String(4 + i), { fontSize: 9, strokeColor: T.coral });
    if (i < 5) {
      line([[sx2 + 18, y + 41], [sx2 + 40, y + 41]], { strokeColor: T.coral, strokeStyle: "dotted" });
      text(sx2 + 23, y + 30, "⌇", { fontSize: 10, strokeColor: T.coral });
    }
    sx2 += 40;
  }
  text(x + 12, y + 58, "6 ayat + 5 junctions.  ⌇ = the joint", { fontSize: 10, strokeColor: T.sec });
  text(x + 12, y + 74, "est. 8.6 min  ·  every step is graded", { fontSize: 10, strokeColor: T.sec });
  y += 112;

  // mode
  text(x, y, "MODE", { fontSize: 10, strokeColor: T.muted });
  y += 20;
  rect(x, y, w, 40, { strokeColor: T.coral, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
  text(x + 12, y + 6, "Graded — repair run", { fontSize: 12, strokeColor: T.coral });
  text(x + 12, y + 23, "slips cost strength; this is real practice", { fontSize: 9, strokeColor: T.muted });
  y += 48;
  rect(x, y, w, 40, { strokeColor: T.border, backgroundColor: T.white, fillStyle: "solid" });
  text(x + 12, y + 6, "Victory lap — free run", { fontSize: 12, strokeColor: T.teal });
  text(x + 12, y + 23, "logged, but can never cost you strength", { fontSize: 9, strokeColor: T.muted });
  y += 56;

  btn(x, y, w, 44, "Start continuous drill", { bg: T.ink });
}

// 13b — page mode
const p10 = phone(500, 9700, "Page mode", "one mushaf page, continuously", { h: 640 });
{
  const { x, w } = p10.inner;
  let y = p10.y + 46;

  let ux = x;
  [["Ayah range", false], ["Page", true]].forEach(([l, on]) => {
    ux += chip(ux, y, l, on
      ? { bg: T.ink, fg: T.white, strokeColor: T.ink, fontSize: 12, h: 30 }
      : { fontSize: 12, h: 30 }) + 8;
  });
  y += 46;

  text(x, y, "MUSHAF — Madani 15-line", { fontSize: 10, strokeColor: T.muted });
  y += 20;

  // page strip — real Yusuf data
  rect(x, y, w, 116, { strokeColor: T.purple, backgroundColor: T.purpleBg, fillStyle: "solid", strokeWidth: 2 });
  text(x + 12, y + 10, "Surah Yusuf spans pages 235–248", { fontSize: 11, strokeColor: "#332a66" });
  const pages = [235, 236, 237, 238, 239, 240, 241];
  let px = x + 12;
  pages.forEach((pn, i) => {
    const on = i === 1;
    rect(px, y + 32, 34, 42, {
      strokeColor: on ? T.purple : T.border,
      backgroundColor: on ? T.purple : T.white,
      fillStyle: "solid",
      strokeWidth: on ? 2 : 1,
    });
    text(px + 5, y + 48, String(pn), { fontSize: 9, strokeColor: on ? T.white : T.muted });
    px += 38;
  });
  text(x + 12, y + 84, "… 248.   Tap a page to drill it end-to-end.", { fontSize: 9, strokeColor: T.sec });
  y += 132;

  // selected page detail
  rect(x, y, w, 104, { strokeColor: T.ink, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
  text(x + 12, y + 10, "PAGE 236", { fontSize: 14 });
  text(x + 12, y + 32, "ayat 5 – 14  ·  10 ayat  ·  9 junctions", { fontSize: 11, strokeColor: T.sec });
  text(x + 12, y + 52, "19 chain steps  ·  est. 14.2 min", { fontSize: 11, strokeColor: T.sec });
  rect(x + 12, y + 74, w - 24, 8, { strokeColor: T.border, sharp: true });
  rect(x + 12, y + 74, (w - 24) * 0.7, 8, { strokeColor: T.teal, backgroundColor: T.teal, fillStyle: "solid", sharp: true });
  text(x + w - 60, y + 88, "7/10 ready", { fontSize: 9, strokeColor: T.teal });
  y += 122;

  // readiness warning
  rect(x, y, w, 74, { strokeColor: T.amber, backgroundColor: T.amberBg, fillStyle: "solid" });
  text(x + 12, y + 10, "3 ayat on this page aren't learned yet", { fontSize: 11, strokeColor: "#7a4d0d" });
  text(x + 12, y + 30, "They'll be SKIPPED, not failed — a chain\nonly credits atoms you've actually encoded\n(the BUG-3 gap guard).", { fontSize: 9, strokeColor: T.sec });
  y += 92;

  btn(x, y, w, 44, "Drill page 236", { bg: T.ink });
}

note(880, 9700, 340, "WHAT'S ALREADY BUILT\nchainSteps(from, to) in engine/src/chain.ts\nALREADY takes an arbitrary range and emits\nayah → junction → ayah → … steps.\n\nSo 'chain a few ayat' needs NO new engine\nwork — only a range picker on top of it.\napplyChain() FIRe-credits every traversed\natom in one pass.", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

note(880, 9890, 340, "TWO MODES ARE ALREADY LOCKED (v2-D11)\n  · applyWeakSeamChain  → structured:true,\n    graded, slips cost strength. A repair tool.\n  · applyVictoryLapChain → structured:false,\n    every step still lands in the event log\n    (streak/heatmap evidence) but update()\n    no-ops, so a slip during a celebratory\n    run-through can NEVER damage a strong\n    verse.\n\nThe picker must expose this choice honestly —\nit is the difference between practice and\nperformance.", { strokeColor: T.coral, bg: T.coralBg, fg: "#712b13" });

note(880, 10160, 340, "PAGE DATA — BLOCKER CLEARED 2026-08-10\nThe geometry is fetched, validated and saved:\nv3/docs/data/yusuf-geometry.json (111/111).\n\nYusuf = pages 235–248 (14 pages), median 8\nayat/page, range 4–11. Juz 12–13, hizb 24–25.\nCross-checked against the independent\n/verses/by_page/236 endpoint — exact match.\n\nSee §13c for the 4-step recipe.", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

note(880, 10380, 340, "WHY A PAGE IS A GOOD DAILY UNIT\nAt a median 8 ayat it is close to the natural\nhifz portion, and huffaz already think in\npages ('I'm on page 236'). It also gives the\ncalendar in §14 a unit the learner recognises\nfrom the mushaf in their hands — not an\nabstract ayah count.", { strokeColor: T.purple, bg: T.purpleBg, fg: "#332a66" });

// ---- 13c · the recipe (blocker cleared) ----
{
  const ry = 10560;
  text(120, ry, "13c · 乗り越える — how the page blocker was cleared", { fontSize: 20 });
  text(120, ry + 28, "Researched and executed 2026-08-10. Not a plan: the data is fetched, validated and committed.", {
    fontSize: 12, strokeColor: T.muted,
  });

  // what was WRONG about the original framing
  rect(120, ry + 54, 640, 96, {
    strokeColor: T.coral, backgroundColor: T.coralBg, fillStyle: "solid", strokeStyle: "dashed",
  });
  text(136, ry + 66, "THE ORIGINAL FRAMING WAS WRONG", { fontSize: 12, strokeColor: "#712b13" });
  text(136, ry + 86, "\"Add page_number to the compiler fetch\" — but buildCorpus.ts DOESN'T FETCH.\nIt maps over a static file: data/yusuf-verses.json, read by io.ts:34.\nThat file has only { verse_number, text_uthmani, words[] } — no geometry at all.\nSo the fix is upstream of the compiler, in the DATA, not in the fetch.", {
    fontSize: 11, strokeColor: T.sec,
  });

  const steps = [
    ["1", "Fetch geometry", "curl the API per surah with\nfields=page_number,juz_number,hizb_number\n&words=true&word_fields=line_number", "DONE ✓", T.teal],
    ["2", "Guard completeness", "Assert 111/111 ayat present before writing.\nThe v0.1 lesson: small pages + a guard,\nnever per-ayah fan-out.", "DONE ✓", T.teal],
    ["3", "Enrich the source file", "Add page_number + line_number to each verse\nin data/yusuf-verses.json (RawVerse gains\ntwo optional fields).", "recipe", T.amber],
    ["4", "Un-null the compiler", "buildCorpus.ts:54 — replace `page: null,\nline: null` with v.page_number ?? null,\nv.line_number ?? null. Two lines.", "recipe", T.amber],
  ];
  let sy2 = ry + 168;
  steps.forEach(([n, t, d, tag, col]) => {
    const h = 76;
    rect(120, sy2, 640, h, { strokeColor: col, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
    ellipse(136, sy2 + 14, 28, 28, { strokeColor: col, backgroundColor: T.white, fillStyle: "solid" });
    text(146, sy2 + 21, n, { fontSize: 13, strokeColor: col });
    text(178, sy2 + 12, t, { fontSize: 14 });
    text(178, sy2 + 34, d, { fontSize: 10, strokeColor: T.sec });
    chip(676, sy2 + 12, tag, tag.includes("✓")
      ? { fontSize: 9, strokeColor: T.teal, fg: T.teal, bg: T.tealBg }
      : { fontSize: 9, strokeColor: T.amber, fg: T.amber });
    sy2 += h + 10;
  });

  // the gotcha
  rect(120, sy2 + 6, 640, 92, {
    strokeColor: T.coral, backgroundColor: T.coralBg, fillStyle: "solid", strokeWidth: 2,
  });
  text(136, sy2 + 18, "THE GOTCHA — would have silently mis-assigned 95% of verses", {
    fontSize: 13, strokeColor: "#712b13",
  });
  text(136, sy2 + 40, "105 of 111 Yusuf verses SPAN MORE THAN ONE LINE (measured, not assumed).\nSo `line` can only mean THE FIRST LINE the verse appears on — never \"the line\".\nAyah 1 = page 235 line 11 (Yusuf starts mid-page); ayah 5 = page 236 line 1.\nIf you need true line-level drilling later, the unit is the WORD, not the verse.", {
    fontSize: 11, strokeColor: T.sec,
  });

  // what came free
  note(800, ry + 168, 330, "WHAT CAME FREE\nThe same call also returns juz_number,\nhizb_number, rub_el_hizb_number, ruku_number\nand manzil_number per verse.\n\nEach is another ready-made daily unit for the\n§13 picker and the §14 calendar — 'one hizb a\nweek' is a very common hifz rhythm. Yusuf\nspans juz 12–13, hizb 24–25.\n\nNo extra work: add them to the same enrich\nstep and the picker gains units for free.", { strokeColor: T.purple, bg: T.purpleBg, fg: "#332a66" });

  note(800, ry + 428, 330, "SURAH-AGNOSTIC BY CONSTRUCTION\npage_number is universal, not Yusuf-specific —\nverified on Al-Mulk (surah 67 → page 562).\n\nSo step 1 is a loop over whichever surahs the\nlibrary ships. Adding a surah stays a\ncompiler run, exactly as v2-D29 requires.", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

  note(800, ry + 590, 330, "OFFLINE FALLBACK (if the API is ever down\nor rate-limits a big recompile)\nThe geometry is 111 integers per surah — it is\nCOMMITTED at v3/docs/data/yusuf-geometry.json,\nso a rebuild never needs the network again.\n\nStatic alternatives exist (quran-meta on npm,\n@quranjs/api) but are unnecessary once the map\nis in the repo. NOTE: urllib gets HTTP 403\nfrom the API — use curl.", { strokeColor: T.amber, bg: T.amberBg, fg: "#7a4d0d" });
}

// ============================================================
// 14 · THE SCHEDULE CALENDAR + COMPLETION FORECAST
// ============================================================
sectionTitle(80, 11400, "14", "The Plan calendar", "A first-class surface — /plan, its own tab. Predictability is the product promise.");

const p11 = phone(120, 11540, "Plan — month", "route: /plan", { h: 700 });
{
  const { x, w } = p11.inner;
  let y = p11.y + 46;

  text(x, y, "Surah Yusuf", { fontSize: 16 });
  text(x, y + 22, "at your Steady pace", { fontSize: 10, strokeColor: T.muted });
  y += 50;

  // headline forecast
  rect(x, y, w, 92, { strokeColor: T.teal, backgroundColor: T.tealBg, fillStyle: "solid", strokeWidth: 2 });
  text(x + 14, y + 12, "PROJECTED COMPLETION", { fontSize: 10, strokeColor: "#085041" });
  text(x + 14, y + 30, "18 March 2027", { fontSize: 20, strokeColor: "#085041" });
  text(x + 14, y + 58, "99 ayat left  ·  1/day  ·  ~99 active days", { fontSize: 10, strokeColor: T.sec });
  text(x + 14, y + 74, "based on YOUR measured pace, not a default", { fontSize: 9, strokeColor: T.teal });
  y += 110;

  // calendar
  text(x, y, "NEXT 4 WEEKS", { fontSize: 10, strokeColor: T.muted });
  y += 22;
  const DOW = ["M", "T", "W", "T", "F", "S", "S"];
  DOW.forEach((d, i) => text(x + 6 + i * 38, y, d, { fontSize: 9, strokeColor: T.muted }));
  y += 18;
  // 4 weeks of cells
  const kinds = [
    // 0 = past done, 1 = today, 2 = planned learn, 3 = review-only, 4 = page milestone
    0, 0, 0, 0, 0, 3, 0,
    0, 1, 2, 2, 2, 3, 4,
    2, 2, 2, 2, 2, 3, 2,
    2, 2, 4, 2, 2, 3, 2,
  ];
  kinds.forEach((k, i) => {
    const cx2 = x + i % 7 * 38;
    const cy2 = y + Math.floor(i / 7) * 38;
    const style = {
      0: { s: T.teal, b: T.teal },
      1: { s: T.ink, b: T.white },
      2: { s: T.border, b: T.white },
      3: { s: T.border, b: T.surface },
      4: { s: T.purple, b: T.purpleBg },
    }[k];
    rect(cx2, cy2, 32, 32, { strokeColor: style.s, backgroundColor: style.b, fillStyle: "solid", strokeWidth: k === 1 ? 2 : 1 });
    if (k === 4) text(cx2 + 10, cy2 + 10, "▣", { fontSize: 11, strokeColor: T.purple });
    if (k === 0) text(cx2 + 11, cy2 + 10, "✓", { fontSize: 10, strokeColor: T.white });
  });
  y += 4 * 38 + 12;

  // legend
  [["✓ done", T.teal], ["today", T.ink], ["planned", T.muted], ["▣ page complete", T.purple]].forEach((l, i) => {
    text(x + (i % 2) * 140, y + Math.floor(i / 2) * 16, l[0], { fontSize: 9, strokeColor: l[1] });
  });
  y += 44;

  // milestones
  text(x, y, "MILESTONES", { fontSize: 10, strokeColor: T.muted });
  y += 20;
  [
    ["Page 236 complete", "in 6 days", T.purple],
    ["Movement 1 (the dream)", "in 11 days", T.purple],
    ["Half the surah", "in 51 days", T.teal],
  ].forEach(([n, w2, col]) => {
    rect(x, y, w, 40, { strokeColor: T.border });
    text(x + 12, y + 7, n, { fontSize: 11 });
    text(x + w - 76, y + 7, w2, { fontSize: 10, strokeColor: col });
    y += 46;
  });

  tabbar(p11, "Surah");
}

// 14b — day detail
const p13 = phone(500, 11540, "Plan — one day", "tap any day", { h: 700 });
{
  const { x, w } = p13.inner;
  let y = p13.y + 46;

  text(x, y, "‹  Thursday 14 Aug", { fontSize: 13, strokeColor: T.sec });
  text(x, y + 22, "in 4 days  ·  planned", { fontSize: 10, strokeColor: T.muted });
  y += 50;

  rect(x, y, w, 56, { strokeColor: T.ink, backgroundColor: T.surface, fillStyle: "solid", strokeWidth: 2 });
  text(x + 12, y + 10, "~9 min  ·  ~11 items", { fontSize: 15 });
  text(x + 12, y + 33, "estimate — reviews firm up nearer the day", { fontSize: 9, strokeColor: T.muted });
  y += 74;

  text(x, y, "WHAT THE SCHEDULER EXPECTS", { fontSize: 10, strokeColor: T.muted });
  y += 22;
  const load = [
    ["Gate check", "ayah 13 — cold check", "certain", T.amber],
    ["Reviews", "~6 due (Yusuf, Al-Mulk)", "estimated", T.teal],
    ["Learn", "ayah 14 — if gate passes", "conditional", T.purple],
    ["Chain", "12→14 run", "optional", T.coral],
  ];
  load.forEach(([k, d, conf, col]) => {
    rect(x, y, w, 48, { strokeColor: T.border });
    text(x + 12, y + 9, k, { fontSize: 12, strokeColor: col });
    text(x + 12, y + 28, d, { fontSize: 10, strokeColor: T.muted });
    chip(x + w - 76, y + 13, conf, { fontSize: 8, strokeColor: col, fg: col });
    y += 54;
  });

  y += 6;
  rect(x, y, w, 62, { strokeColor: T.amber, backgroundColor: T.amberBg, fillStyle: "solid" });
  text(x + 12, y + 10, "Can't make Thursday?", { fontSize: 12, strokeColor: "#7a4d0d" });
  text(x + 12, y + 30, "Mark it away — the forecast adjusts\nhonestly instead of scoring it a miss.", { fontSize: 9, strokeColor: T.sec });
  y += 78;

  btn(x, y, w, 40, "Mark as away", { bg: T.transparent, fg: T.ink, strokeColor: T.ink });
}

// 14c — confidence decay diagram
{
  const cy0 = 12300;
  text(120, cy0, "14c · Confidence decays with distance — the honesty mechanic", { fontSize: 18 });
  text(120, cy0 + 26, "Reviews are generated from decay, so far-future days genuinely cannot be known. The UI must SHOW that.", {
    fontSize: 12, strokeColor: T.muted,
  });

  const zones = [
    ["TODAY → +3 days", "CONCRETE", "Exact items: 'gate ayah 13, 6 reviews,\nlearn ayah 14.' The scheduler can\nactually resolve this.", T.teal, 1.0],
    ["+4 → +14 days", "ESTIMATED", "Load only: '~9 min, ~11 items.'\nKinds shown, specific ayat not.\nConfidence band widens.", T.amber, 0.6],
    ["+15 days → end", "TRAJECTORY", "Just the shape: 'about 8 min/day,\nfinishing mid-March.' No day-level\nclaims at all.", T.muted, 0.3],
  ];
  let zx = 120;
  zones.forEach(([span, label, body, col, op]) => {
    rect(zx, cy0 + 60, 400, 150, { strokeColor: col, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
    text(zx + 16, cy0 + 74, span, { fontSize: 13, strokeColor: col });
    chip(zx + 300, cy0 + 72, label, { fontSize: 9, strokeColor: col, fg: col });
    text(zx + 16, cy0 + 104, body, { fontSize: 11, strokeColor: T.sec });
    // fading density strip
    for (let i = 0; i < 12; i++) {
      rect(zx + 16 + i * 30, cy0 + 176, 22, 16, {
        strokeColor: col, backgroundColor: col, fillStyle: "solid", sharp: true,
        opacity: Math.round(op * 100 - i * (op * 6)),
      });
    }
    zx += 420;
  });

  note(120, cy0 + 226, 840, "WHY THIS IS THE RIGHT ANSWER RATHER THAN A COP-OUT\nPopulating every future day with specific ayat would look more satisfying and be a lie — the scheduler picks reviews from\nmeasured decay, and a review 3 weeks out depends on how the next 20 sessions actually go. Showing invented precision would\nbreak the same honesty contract as §10's retention numbers and §14's 'never shorten the date to motivate'.\n\nThe learner still gets what they asked for — PREDICTABILITY — because the COMMITMENT is stable ('~8 min/day, 1 new ayah')\neven when the item list is not. Predictable EFFORT, honest DETAIL.", { strokeColor: T.purple, bg: T.purpleBg, fg: "#332a66" });
}

note(880, 11560, 350, "THE FORECAST IS ALREADY HALF-BUILT\nplanFor() in engine/src/capacity.ts returns\n{ ayahPerDay, etaDays, remaining } from\nremainingAyat + avgWordsPerAyah + minutesPerDay,\nusing Appendix A's cost model\n(T ≈ 0.33·W_new + 0.4·R_due + 1.25·chains\n+ 0.17·junctions).\n\nv3 needs to (a) fix E-06 — divide the budget\nacross ACTIVE SURAHS, not give each the whole\nday — and (b) project etaDays onto a real\ncalendar.", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

note(460, 11810, 350, "HONESTY RULES FOR A FORECAST\n  · Use the learner's MEASURED pace, never the\n    nominal one. planFor() already takes\n    minutesPerDay — feed it observed minutes.\n  · Count ACTIVE days, not calendar days. A\n    learner who drills 4×/week finishes later,\n    and the date must say so.\n  · Re-forecast after every session. A date\n    that never moves is a promise, not a\n    prediction.\n  · Show the assumption INLINE ('1/day, ~6 min')\n    so a slipping date is explainable.\n  · NEVER shorten the date to motivate. That is\n    the one lie that destroys the whole\n    retention-honesty stance in §10.", { strokeColor: T.coral, bg: T.coralBg, fg: "#712b13" });

note(460, 12130, 350, "FIRST WEEK IS DELIBERATELY UNDERLOADED\nplanFor() returns habitProtocol:\n{ underloaded: true, secondThreadFromDay: 3 }.\nThe forecast must reflect that ramp rather\nthan assuming full pace from day 1 —\notherwise week 1 always looks 'behind'.", { strokeColor: T.amber, bg: T.amberBg, fg: "#7a4d0d" });

// ============================================================
// 15 · TIME MEASUREMENT + ACCESSIBLE PROGRESS LIST
// ============================================================
sectionTitle(80, 13700, "15", "Time measured · progress accessible", "Every step timed; the whole list reachable and screen-readable.");

// 15a — timing
{
  const y0 = 13820;
  text(80, y0, "WHAT IS ALREADY TIMED", { fontSize: 14 });
  const timed = [
    ["DrillEvent.latency", "ms per tap — the time-per-word metric (v0.6)", T.teal, "built"],
    ["sessionSummary.durationMs", "first tap → last tap, formatted m:ss", T.teal, "built"],
    ["session_start.latency", "app-open → first drill (v0.8)", T.teal, "built"],
    ["resumePolicy()", "classifies gaps; discards interrupted latencies", T.teal, "built"],
    ["per-ayah time-to-encode", "sum of latencies from first tap to S3 pass", T.amber, "derive"],
    ["per-page / per-chain time", "sum over a continuous run (§13)", T.amber, "derive"],
    ["time-to-carry", "first encounter → strength ≥ 80", T.amber, "derive"],
  ];
  timed.forEach(([n, d, col, tag], i) => {
    const yy = y0 + 26 + i * 44;
    rect(80, yy, 700, 36, { strokeColor: col, backgroundColor: T.white, fillStyle: "solid" });
    text(96, yy + 10, n, { fontSize: 12, strokeColor: col });
    text(340, yy + 11, d, { fontSize: 10, strokeColor: T.sec });
    chip(694, yy + 7, tag, tag === "built"
      ? { fontSize: 9, strokeColor: T.teal, fg: T.teal }
      : { fontSize: 9, strokeColor: T.amber, fg: T.amber });
  });

  note(810, y0 + 20, 340, "Nothing new needs instrumenting. Every\n'derive' row is a fold over latencies ALREADY\nin the event log — the same trick as §10's\nserver-side metrics.\n\nOne caveat: interrupted latencies are\ndiscarded by design (resume.ts). Time-taken\nmust therefore be reported as 'time on task',\nnever wall-clock, or a learner who took a\nphone call looks slower than they were.", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });
}

// 15b — the accessible progress list
const p12 = phone(120, 14180, "Progress list", "route: /progress/list", { h: 700 });
{
  const { x, w } = p12.inner;
  let y = p12.y + 46;

  text(x, y, "All ayat", { fontSize: 16 });
  text(x, y + 22, "111 items · sortable · searchable", { fontSize: 10, strokeColor: T.muted });
  y += 48;

  // controls
  rect(x, y, w, 32, { strokeColor: T.border });
  text(x + 10, y + 9, "Search or jump to ayah…", { fontSize: 11, strokeColor: T.muted });
  y += 42;
  let fx = x;
  [["All", true], ["Due", false], ["Weak", false], ["Page", false]].forEach(([l, on]) => {
    fx += chip(fx, y, l, on ? { bg: T.ink, fg: T.white, strokeColor: T.ink } : {}) + 6;
  });
  y += 38;

  text(x, y, "Sort: strength ↑", { fontSize: 10, strokeColor: T.teal });
  y += 24;

  // rows — a real table, not a heatmap
  const rows = [
    ["3", "lapsed", "48%", "4d ago", "2:10", T.coral],
    ["9", "learning", "61%", "today", "3:42", T.amber],
    ["7", "reinforce", "74%", "1d ago", "1:55", T.teal],
    ["1", "carry", "92%", "6d ago", "0:48", "#085041"],
    ["2", "carry", "89%", "6d ago", "1:02", "#085041"],
  ];
  // header
  text(x + 6, y, "AYAH", { fontSize: 8, strokeColor: T.muted });
  text(x + 54, y, "STAGE", { fontSize: 8, strokeColor: T.muted });
  text(x + 132, y, "STR", { fontSize: 8, strokeColor: T.muted });
  text(x + 176, y, "SEEN", { fontSize: 8, strokeColor: T.muted });
  text(x + 226, y, "TIME", { fontSize: 8, strokeColor: T.muted });
  y += 16;
  rows.forEach(([n, st, s, seen, t, col]) => {
    rect(x, y, w, 40, { strokeColor: T.border });
    text(x + 8, y + 13, n, { fontSize: 12 });
    text(x + 48, y + 8, st, { fontSize: 9, strokeColor: col });
    // strength bar + number (never colour alone)
    rect(x + 48, y + 24, 60, 6, { strokeColor: T.border, sharp: true });
    rect(x + 48, y + 24, 60 * (parseInt(s) / 100), 6, { strokeColor: col, backgroundColor: col, fillStyle: "solid", sharp: true });
    text(x + 130, y + 13, s, { fontSize: 10, strokeColor: T.ink });
    text(x + 172, y + 13, seen, { fontSize: 9, strokeColor: T.muted });
    text(x + 224, y + 13, t, { fontSize: 9, strokeColor: T.sec });
    y += 46;
  });
  text(x + w / 2 - 34, y + 4, "… 106 more", { fontSize: 10, strokeColor: T.muted });
  y += 30;

  rect(x, y, w, 52, { strokeColor: T.purple, backgroundColor: T.purpleBg, fillStyle: "solid" });
  text(x + 12, y + 10, "Median time to carry: 4 sessions", { fontSize: 11, strokeColor: "#332a66" });
  text(x + 12, y + 30, "Your own measured figure.", { fontSize: 9, strokeColor: T.sec });

  tabbar(p12, "Progress");
}

note(460, 14200, 380, "\"ENSURE PROGRESS LIST IS ACCESSIBLE\" — read\nboth ways, because both matter:\n\n1. REACHABLE. The ring (§3) and heatmap are\n   beautiful but they are pictures. A plain,\n   sortable, searchable LIST of all 111 ayat\n   must exist as its own route — the only view\n   that scales to a learner with 5 surahs.\n\n2. ACCESSIBLE (a11y). This is where a colour-\n   coded ring fails hardest.", { strokeColor: T.purple, bg: T.purpleBg, fg: "#332a66" });

note(460, 14460, 380, "A11Y REQUIREMENTS — non-negotiable\n  · NEVER colour alone. Every stage carries a\n    text label AND a number (see the rows).\n    Teal/coral are indistinguishable to ~8% of\n    men with deuteranopia.\n  · Semantic <table> with real headers, not a\n    grid of <div>s. Screen readers announce\n    'Ayah 3, lapsed, 48%'.\n  · Arabic is dir=\"rtl\" with lang=\"ar\"; the UI\n    chrome stays dir=\"ltr\". Mixed-direction\n    rows are the classic bug here.\n  · Tap targets ≥44px (already v2-D28).\n  · The ring must have this list as its\n    documented text alternative, not aria-\n    labels bolted onto <circle> elements.\n  · Respect prefers-reduced-motion on the\n    progress animations.", { strokeColor: T.coral, bg: T.coralBg, fg: "#712b13" });

note(460, 14780, 380, "TIME COLUMN = the answer to 'measure time\ntaken for every progress'. Per-ayah cumulative\ntime-on-task, summed from latencies already in\nthe log.\n\nIt is also the most motivating honest number\nthe app has: 'ayah 1 took you 48 seconds this\nweek, down from 3 minutes' is real evidence of\nfluency, not a streak badge.", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

// ============================================================
// 16 · ADMIN CONSOLE — desktop operator surface
// ============================================================
sectionTitle(80, 15060, "16", "Admin console (desktop)", "Login → users → system health → learning science → qari gate. Full redesign, desktop-native.");

const NAV = ["Overview", "Users", "System Health", "Learning Science", "Qari Review", "Audit Log"];

// 16a — login
{
  const d = desktop(120, 15200, 520, 320, "Login", "route: /admin/login", { sidebar: false, url: "iman.app/admin/login" });
  const cx = d.x + d.w / 2;
  rect(cx - 170, d.y + 70, 340, 190, { strokeColor: T.border, backgroundColor: T.surface, fillStyle: "solid" });
  text(cx - 76, d.y + 86, "iman.app · operator", { fontSize: 13 });
  text(cx - 154, d.y + 116, "Email", { fontSize: 9, strokeColor: T.muted });
  rect(cx - 154, d.y + 130, 308, 28, { strokeColor: T.border, backgroundColor: T.white, fillStyle: "solid" });
  text(cx - 154, d.y + 166, "Password", { fontSize: 9, strokeColor: T.muted });
  rect(cx - 154, d.y + 180, 308, 28, { strokeColor: T.border, backgroundColor: T.white, fillStyle: "solid" });
  btn(cx - 154, d.y + 218, 308, 30, "Sign in", { bg: T.teal, strokeColor: T.teal });
  text(cx - 154, d.y + 262, "Access restricted to ADMIN_EMAILS.\nAll admin actions are audit-logged.", { fontSize: 8, strokeColor: T.muted });
}

note(680, 15200, 360, "FAILS CLOSED — and says nothing\nWrong password and not-on-the-allowlist return\nthe SAME generic error:\n\n  \"Not authorized for operator access.\"\n\nNo signup link, no password reset, no hint\nwhich of the two failed. That prevents email\nENUMERATION — otherwise the login form becomes\na free oracle for 'is this address an admin?'.\n\nSession expiry mid-use → re-auth modal with\nwork preserved, never a silent redirect that\ndiscards a half-written override.", { strokeColor: T.coral, bg: T.coralBg, fg: "#712b13" });

// 16b — overview
{
  const d = desktop(120, 15660, 1180, 520, "Overview", "the 30-second answer: is the product working, is the system alive?", { url: "iman.app/admin" });
  sidebarNav(d, NAV, "Overview");
  const c = d.content;

  // topbar
  rect(c.x + 14, d.y + 44, 220, 22, { strokeColor: T.border });
  text(c.x + 20, d.y + 49, "search user / surah:ayah", { fontSize: 9, strokeColor: T.muted });
  chip(c.x + 250, d.y + 44, "PROD", { fontSize: 9, strokeColor: T.amber, fg: T.amber, bg: T.amberBg });
  chip(c.x + 306, d.y + 44, "sync lag p95 42s", { fontSize: 9, strokeColor: T.teal, fg: T.teal });
  text(c.x + c.w - 90, d.y + 49, "🔔 3", { fontSize: 10, strokeColor: T.coral });

  let y = c.y + 16;
  // north star
  tile(c.x + 14, y, 300, 88, "NORTH STAR — P(recall @ 10y), median projected", "0.71", "+0.02 over 7d · from the stability distribution",
    { strokeColor: T.teal, bg: T.tealBg, fg: "#085041", valueSize: 30 });

  const stats = [
    ["active_learners_7d", "1,284", ""],
    ["atoms_total", "281k", ""],
    ["events_ingested_24h", "94.2k", ""],
    ["gates_armed_today", "412", ""],
    ["gate_pass_rate_7d", "78%", ""],
    ["sync_error_rate_24h", "0.03%", "ok"],
  ];
  stats.forEach(([l, v, s], i) => {
    tile(c.x + 330 + (i % 3) * 200, y + Math.floor(i / 3) * 46, 190, 40, l, v, "", { valueSize: 14 });
  });
  y += 104;

  // band distribution
  text(c.x + 14, y, "STRENGTH-BAND DISTRIBUTION", { fontSize: 9, strokeColor: T.muted });
  y += 16;
  const bands = [["lapsed", 0.07, T.coral], ["learn", 0.21, T.amber], ["reinforce", 0.34, T.teal], ["carry", 0.38, "#085041"]];
  let bx = c.x + 14;
  bands.forEach(([n, f, col]) => {
    const bw = 600 * f;
    rect(bx, y, bw, 26, { strokeColor: col, backgroundColor: col, fillStyle: "solid", sharp: true });
    text(bx + 4, y + 32, `${n} ${Math.round(f * 100)}%`, { fontSize: 8, strokeColor: col });
    bx += bw;
  });
  y += 58;

  // decay chart
  text(c.x + 14, y, "COHORT RETRIEVABILITY — median exp(−Δt/stability)", { fontSize: 9, strokeColor: T.muted });
  rect(c.x + 14, y + 14, 380, 110, { strokeColor: T.border, backgroundColor: T.white, fillStyle: "solid" });
  const dp = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    dp.push([c.x + 24 + t * 360, y + 24 + (1 - Math.exp(-t * 2.6)) * 88]);
  }
  line(dp, { strokeColor: T.coral, strokeWidth: 2 });
  text(c.x + 250, y + 34, "median half-life 9.4d", { fontSize: 9, strokeColor: T.teal });

  // ingest + anomalies
  text(c.x + 420, y, "INGEST THROUGHPUT / QUEUE DEPTH", { fontSize: 9, strokeColor: T.muted });
  rect(c.x + 420, y + 14, 240, 110, { strokeColor: T.border, backgroundColor: T.white, fillStyle: "solid" });
  const sp = [];
  for (let i = 0; i <= 30; i++) sp.push([c.x + 428 + i * 7.6, y + 100 - (30 + 25 * Math.sin(i / 2.4) + (i % 5) * 3)]);
  line(sp, { strokeColor: T.teal, strokeWidth: 1 });
  text(c.x + 428, y + 112, "events/min, 24h · queue depth 12", { fontSize: 8, strokeColor: T.muted });

  text(c.x + 684, y, "RECENT ANOMALIES", { fontSize: 9, strokeColor: T.muted });
  rect(c.x + 684, y + 14, 250, 110, { strokeColor: T.border, backgroundColor: T.white, fillStyle: "solid" });
  [["fold_lag_s 318", T.coral], ["rejected_events spike", T.amber], ["calibration bin 0.7 off 6pt", T.amber]].forEach(([t, col], i) => {
    text(c.x + 692, y + 26 + i * 22, "· " + t, { fontSize: 9, strokeColor: col });
  });
}

// 16c — user drill-down
{
  const d = desktop(120, 16260, 1180, 470, "User drill-down", "route: /admin/users/{id} — full learning state, reconstructed from events", { url: "iman.app/admin/users/u_7f3a…" });
  sidebarNav(d, NAV, "Users");
  const c = d.content;

  text(c.x + 14, d.y + 46, "u_7f3a9c   ·   joined 2026-03-11   ·   2 devices", { fontSize: 12 });
  btn(c.x + c.w - 150, d.y + 42, 136, 24, "Reveal identity", { bg: T.transparent, fg: T.coral, strokeColor: T.coral, fontSize: 10 });

  let tx = c.x + 14;
  ["Atoms", "Decay", "Gates", "Events"].forEach((t, i) => {
    tx += chip(tx, c.y + 12, t, i === 0
      ? { bg: T.ink, fg: T.white, strokeColor: T.ink, fontSize: 10 }
      : { fontSize: 10 }) + 6;
  });

  const cols = [["ATOM", 130], ["TYPE", 90], ["STRENGTH", 110], ["STABILITY_D", 90], ["DIFF", 60], ["REPS", 50], ["LAPSES", 60], ["ENCODED", 70], ["LAST RETRIEVAL", 120]];
  const rows = [
    ["12:3", "ayah", ["48  lapsed", T.coral], "2.1", "0.55", "9", ["2", T.coral], "yes", "4d ago"],
    ["12:4", "ayah", ["61  learn", T.amber], "3.4", "0.41", "6", "0", "yes", "today"],
    [["12:4 ⋈ 12:5", T.purple], ["connection", T.purple], ["55  reinforce", T.teal], "2.9", "0.38", "4", "0", "yes", "1d ago"],
    ["12:5", "ayah", ["88  carry", "#085041"], "13.2", "0.22", "11", "0", "yes", "6d ago"],
    ["67:1", "ayah", ["92  carry", "#085041"], "18.0", "0.19", "14", "0", "yes", "8d ago"],
  ];
  const endY = table(c.x + 14, c.y + 48, c.w - 28, cols, rows);

  rect(c.x + 14, endY + 10, c.w - 28, 34, { strokeColor: T.purple, backgroundColor: T.purpleBg, fillStyle: "solid" });
  text(c.x + 24, endY + 20, "Events tab is READ-ONLY. Atoms are a fold of the log — staff may never edit a graded event or set a strength by hand.", {
    fontSize: 10, strokeColor: "#332a66",
  });

  text(c.x + 14, endY + 58, "Only rare action: “Rebuild atom cache from events” — confirm modal, audit-logged. It re-derives, never invents.", {
    fontSize: 10, strokeColor: T.muted,
  });
}

note(1330, 15660, 360, "PRIVACY BY DEFAULT — the spec's strongest idea\nEvery learner is PSEUDONYMOUS everywhere\n(u_7f3a…). Email/name sit behind a “Reveal\nidentity” button that requires a TYPED REASON,\nis audit-logged, and AUTO-RE-MASKS after 15\nminutes.\n\nBulk CSV exports strip identity entirely.\n\nWhy it matters here more than in most apps:\nthe event log records how a person engages\nwith the Qur'an. That is unusually intimate\ndata and deserves a higher bar than product\nanalytics norms.", { strokeColor: T.purple, bg: T.purpleBg, fg: "#332a66" });

note(1330, 15980, 360, "NO ENGAGEMENT-BAIT METRICS — anywhere\nThere is deliberately NO DAU tile, no streak\nleaderboard, no session-count hero.\n\nThe north star is P(recall @ 10y). An operator\nconsole that celebrated DAU would quietly\nsteer the product toward the thing §10 refuses\nto optimise for. The console has to embody the\nsame values as the learner-facing app, or it\nwill win the argument by default.", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

// 16d — system health + learning science + qari (three panels)
{
  const d = desktop(120, 16810, 1180, 500, "System health · learning science · qari gate", "three screens, condensed", { url: "iman.app/admin/health" });
  sidebarNav(d, NAV, "System Health");
  const c = d.content;

  // pipeline
  text(c.x + 14, c.y + 10, "SYNC PIPELINE — each stage shows live rate + status", { fontSize: 10, strokeColor: T.muted });
  const stages = [
    ["Client\nIndexedDB", T.teal], ["batch(200)\nPOST", T.teal], ["idempotency\ncheck", T.teal],
    ["event store", T.teal], ["fold worker", T.coral], ["atom cache", T.teal],
  ];
  let px = c.x + 14;
  stages.forEach(([t, col], i) => {
    rect(px, c.y + 28, 130, 50, { strokeColor: col, backgroundColor: col === T.coral ? T.coralBg : T.white, fillStyle: "solid", strokeWidth: col === T.coral ? 2 : 1 });
    text(px + 8, c.y + 40, t, { fontSize: 9, strokeColor: T.ink });
    if (i < stages.length - 1) arrow([[px + 130, c.y + 53], [px + 150, c.y + 53]], { strokeColor: T.border });
    px += 150;
  });
  text(c.x + 640, c.y + 84, "fold_lag_s 318  ← the one that's red", { fontSize: 9, strokeColor: T.coral });

  // health tiles
  const ht = [
    ["duplicate_uuid_rate", "1.2%", "idempotency working"],
    ["rejected_events_24h", "18", "schema drift?"],
    ["mirror_events_skipped", "3.1k", "test_* — expected"],
    ["fold_determinism_check", "100%", "nightly re-fold"],
  ];
  ht.forEach(([l, v, s], i) => {
    tile(c.x + 14 + i * 230, c.y + 100, 220, 52, l, v, s, {
      valueSize: 15,
      strokeColor: l === "fold_determinism_check" ? T.teal : T.border,
      bg: l === "fold_determinism_check" ? T.tealBg : T.white,
    });
  });

  // FSRS calibration
  text(c.x + 14, c.y + 172, "FSRS CALIBRATION — predicted vs actual, 10 retrievability bins", { fontSize: 10, strokeColor: T.muted });
  rect(c.x + 14, c.y + 188, 300, 150, { strokeColor: T.border, backgroundColor: T.white, fillStyle: "solid" });
  line([[c.x + 24, c.y + 328], [c.x + 304, c.y + 198]], { strokeColor: T.border, strokeStyle: "dashed" });
  [[0.1, 0.12], [0.2, 0.19], [0.3, 0.34], [0.4, 0.38], [0.5, 0.52], [0.6, 0.57], [0.7, 0.64], [0.8, 0.82], [0.9, 0.88]].forEach(([p, a]) => {
    const off = Math.abs(p - a) > 0.05;
    ellipse(c.x + 20 + p * 280, c.y + 332 - a * 130, 8, 8, {
      strokeColor: off ? T.amber : T.teal,
      backgroundColor: off ? T.amber : T.teal,
      fillStyle: "solid",
    });
  });
  text(c.x + 24, c.y + 200, "bin 0.7 off by 6pt → amber", { fontSize: 8, strokeColor: T.amber });

  // stall map
  text(c.x + 334, c.y + 172, "STALL MAP — lapse_rate by surah × position", { fontSize: 10, strokeColor: T.muted });
  rect(c.x + 334, c.y + 188, 300, 150, { strokeColor: T.border, backgroundColor: T.white, fillStyle: "solid" });
  for (let r = 0; r < 6; r++) {
    for (let col2 = 0; col2 < 14; col2++) {
      const v = (r === 2 && col2 > 8) || (r === 4 && col2 === 5) ? 0.8 : 0.15 + ((r * col2) % 5) / 14;
      rect(c.x + 342 + col2 * 20, c.y + 198 + r * 22, 18, 20, {
        strokeColor: T.border, backgroundColor: v > 0.6 ? T.coral : v > 0.35 ? T.amber : T.tealBg,
        fillStyle: "solid", sharp: true, opacity: 90,
      });
    }
  }
  text(c.x + 342, c.y + 332, "purple row = junction atoms — where chains break", { fontSize: 8, strokeColor: T.purple });

  // qari gate
  text(c.x + 654, c.y + 172, "QARI REVIEW — the hard launch gate", { fontSize: 10, strokeColor: T.muted });
  rect(c.x + 654, c.y + 188, 300, 150, { strokeColor: T.purple, backgroundColor: T.purpleBg, fillStyle: "solid", strokeWidth: 2 });
  text(c.x + 664, c.y + 200, "verified_atoms / frontier_total", { fontSize: 9, strokeColor: "#332a66" });
  rect(c.x + 664, c.y + 218, 280, 16, { strokeColor: T.border, backgroundColor: T.white, fillStyle: "solid", sharp: true });
  rect(c.x + 664, c.y + 218, 280 * 0.62, 16, { strokeColor: T.purple, backgroundColor: T.purple, fillStyle: "solid", sharp: true });
  text(c.x + 664, c.y + 240, "687 / 1108  ·  62%", { fontSize: 11, strokeColor: "#332a66" });
  text(c.x + 664, c.y + 262, "PUBLIC LAUNCH BLOCKED UNTIL 100%", { fontSize: 11, strokeColor: T.coral });
  text(c.x + 664, c.y + 284, "Overrides are an ADDITIVE layer — the base\ncorpus is never mutated. Every override needs\na typed rationale and is attributed forever.", { fontSize: 9, strokeColor: T.sec });
}

note(1330, 16810, 360, "fold_determinism_check IS THE KEY WIDGET\nA nightly job re-folds a sample of the event\nlog from scratch and compares it to the live\natom cache. It must be 100%.\n\nAny divergence is the HIGHEST-severity page —\nbecause it means the cache disagrees with\ntruth, which is exactly the failure invariant\n#2 exists to prevent. Without this check,\ninvariant #2 is a claim; with it, it is\nMONITORED.\n\nThis is the single best idea in the admin\nspec.", { strokeColor: T.coral, bg: T.coralBg, fg: "#712b13" });

note(1330, 17080, 360, "ALERTS AN OPERATOR IS PAGED FOR\n  · fold_determinism divergence — ANY (coral)\n  · sync_error_rate >1% for 15min\n  · fold_lag_s >300 or worker dead\n  · 5xx >0.5% or p99 >2s on /sync\n  · queue_depth monotonic 30min\n  · rejected_events spike (client schema drift)\n  · FSRS calibration bin off >8pt weekly\n    — a SCIENCE regression, not an outage\n  · gate_pass_rate_7d drop >10pt\n  · repeated non-allowlisted admin logins", { strokeColor: T.amber, bg: T.amberBg, fg: "#7a4d0d" });

// ============================================================
// 17 · ONBOARDING — recall before identity
// ============================================================
sectionTitle(80, 17460, "17", "Strategic onboarding", "Governing rule: RECALL BEFORE IDENTITY. Nothing is asked until an ayah has been produced from memory.");

{
  const ob = [
    ["1", "The honest promise", "not skippable · ~5s", T.teal, [
      "وَلَقَدْ يَسَّرْنَا ٱلْقُرْءَانَ لِلذِّكْرِ",
      "\"Memorizing is easy. Keeping it",
      "is not. Without review, most of a",
      "new ayah is gone within a day.\"",
      "",
      "[ Show me ]",
    ], "Sets the RETENTION frame in one\nscreen, so gates, calendar and\nhalf-life all read as coherent\nlater — not restrictive.\n\nNo carousel. Carousels are where\napps lose ~40% before any value."],
    ["2", "First recall, immediately", "not skippable · ~45s", T.coral, [
      "Al-Ikhlas 112:1 — live",
      "",
      "pass 1  read it once",
      "pass 2  2 words hidden, bank of 4",
      "pass 3  fully hidden, rebuild whole",
      "",
      "✓ \"You just recalled it blind.\"",
    ], "★ THE SINGLE MOST IMPORTANT\nMOMENT IN THE FLOW.\n\nA successful blind reconstruction\ninside the first minute — before\nwe have asked for ANYTHING.\n\nMost apps lose users at a signup\nwall or a 7-question quiz placed\nbefore any value exists."],
    ["3", "Gloss language", "not skippable · one tap", T.teal, [
      "\"Meaning shown in:\"",
      "",
      "[ English ]   [ Bahasa Melayu ]",
      "",
      "default = device locale",
    ], "The scheduler genuinely needs it.\nAsked as ONE binary tap, never a\nsettings page."],
    ["4", "Placement probe", "SKIPPABLE · default fresh", T.purple, [
      "\"Do you already carry some Quran?\"",
      "",
      "3 narrative-landmark probes:",
      "\"the kingdom → the lamps → the birds\"",
      "",
      "Yes / Shaky / No  — tapped,",
      "never recited aloud",
    ], "Seeds FSRS priors as 'known but\nunstable', so review load is\nrealistic from day one.\n\nSkippable because false modesty is\nharmless — gates discover the truth\nanyway — but a mandatory exam here\nwould feel like judgment."],
    ["5", "Choose your surah", "not skippable · pre-selected", T.purple, [
      "Recommended, each row:",
      "  Arabic name (Amiri)",
      "  ayah count",
      "  est. completion at steady pace",
      "  macro-panel thumbnail",
      "",
      "default ▸ Al-Mulk, 30 ayat, ~5 wks",
    ], "The learner's ONE real choice —\nownership of the goal.\n\nEverything downstream (which card\nis next, what difficulty) the app\ndecides."],
    ["6", "Pace", "not skippable · pre-selected", T.amber, [
      "STEADY  ~1 new ayah/day (default)",
      "SPRINT  faster intake, heavier",
      "        review debt",
      "MAINTAIN  no new ayat",
      "",
      "+ live 7-day load strip,",
      "  distant days faded",
    ], "The last scheduler input. Showing\nthe LOAD CONSEQUENCE at selection\ntime is the §14c honesty mechanic\nin miniature."],
    ["7", "First real session", "the product itself", T.teal, [
      "New ayah → tap-to-reconstruct",
      "→ produced whole",
      "",
      "\"Ayah 1 is yours — for now.",
      " A check unlocks tomorrow.\"",
      "",
      "THEN: notification sheet (default",
      "off) · \"Save progress\" quiet link",
    ], "Cold gate armed. ONLY NOW does the\napp ask for anything.\n\nNotification copy is contextual:\n'One a day, never guilt.'\nAccount is a LINK, never a wall."],
  ];

  let oy = 17580;
  ob.forEach(([n, title, meta, col, screen, why]) => {
    const h = Math.max(190, screen.length * 17 + 76);
    // step number + phone-ish screen
    ellipse(80, oy + 10, 34, 34, { strokeColor: col, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
    text(91, oy + 19, n, { fontSize: 15, strokeColor: col });

    rect(140, oy, 300, h, { strokeColor: col, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
    text(156, oy + 12, title, { fontSize: 14, strokeColor: col });
    text(156, oy + 32, meta, { fontSize: 9, strokeColor: T.muted });
    line([[140, oy + 48], [440, oy + 48]], { strokeColor: T.border });
    screen.forEach((l, i) => {
      const isArabic = /[؀-ۿ]/.test(l);
      text(156, oy + 58 + i * 17, l, {
        fontSize: isArabic ? 14 : 10,
        strokeColor: isArabic ? T.ink : l.startsWith("[") || l.startsWith("✓") ? col : T.sec,
      });
    });

    // why panel
    rect(470, oy, 420, h, { strokeColor: T.border, backgroundColor: T.surface, fillStyle: "solid" });
    text(486, oy + 12, "WHY", { fontSize: 9, strokeColor: T.muted });
    text(486, oy + 30, why, { fontSize: 11, strokeColor: T.sec });

    oy += h + 16;
  });

  note(920, 17580, 380, "DATA CAPTURED, TOTAL:\n  · gloss language\n  · optional placement priors\n  · surah\n  · pace\n\nNothing else. No age, no gender, no\n\"how did you hear about us\", no email\nbefore value.\n\nEvery field here is consumed by the SCHEDULER.\nIf a question doesn't change what the engine\ndoes tomorrow, it isn't asked.", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

  note(920, 17810, 380, "ANONYMOUS-FIRST IS ALREADY THE BACKEND\nv2-D03 shipped Sanctum auth as anonymous-first\nwith account adoption. So 'recall before\nidentity' is not a new backend requirement —\nit is the FLOW finally matching what the API\nalready supports.\n\nThe account link appears once, quietly, after\nthe first gate is armed.", { strokeColor: T.purple, bg: T.purpleBg, fg: "#332a66" });

  note(920, 18070, 380, "WHERE THIS COULD STILL GO WRONG\nScreen 2 uses Al-Ikhlas — chosen because\nnearly every target user half-knows it. That\nis also its risk: a learner who does NOT know\nit meets failure as their first experience.\n\nMitigation: pass 1 SHOWS the full ayah before\nany recall is asked. Nobody is tested on\nsomething they were never shown.", { strokeColor: T.coral, bg: T.coralBg, fg: "#712b13" });
}

// ============================================================
// 18 · LANDING PAGE
// ============================================================
sectionTitle(80, 19100, "18", "Landing page", "Converts on recognition of a private failure — not urgency, not FOMO, not testimonials we don't have.");

{
  const lx = 140, lw = 460;
  let ly = 19240;

  const sections = [
    ["1 · HERO", T.ink, [
      ["h", "\"You memorized it."],
      ["h", "Do you still have it?\""],
      ["p", "iman is spaced repetition for the Quran."],
      ["p", "Learn a short surah, then keep it — with"],
      ["p", "two-minute daily checks scheduled exactly"],
      ["p", "when you'd start to forget."],
      ["cta", "[ Try one surah free — no card ]"],
    ], "Names the loss the visitor ALREADY KNOWS\nPRIVATELY. Loss-of-what-you-had is the true\nwedge — not 'memorize faster'.\n\nVisual: phone frame, reconstruction mid-tap,\nAmiri ayah dominant. Flat, no gradient."],

    ["2 · INTERACTIVE DEMO", T.coral, [
      ["p", "Fully working tap-to-reconstruct of"],
      ["p", "Al-Ikhlas 112:1 — inline, no install."],
      ["p", ""],
      ["p", "\"No typing. No Arabic keyboard."],
      ["p", " Just tap the words back into place.\""],
      ["p", ""],
      ["cta", "\"That took 40 seconds. Imagine still"],
      ["cta", " having it in ten years.\""],
    ], "★ THIS IS THE CONVERSION ENGINE.\nThe mechanic sells itself; DESCRIBING it does\nnot. Put a working drill on the page.\n\nIt is also the primary metric's numerator —\nsee 'demo-qualified starts'."],

    ["3 · THE MECHANISM", T.teal, [
      ["p", "① Rebuild, don't reread"],
      ["p", "    retrieval IS the practice"],
      ["p", "② The overnight gate"],
      ["p", "    \"New ayat unlock only after"],
      ["p", "     yesterday's holds.\""],
      ["p", "③ An honest number"],
      ["p", "    half-life 9.4d · 72% → 64%"],
    ], "Three flat panels. Coral used ONLY on the\ngate/slip concept — never decoratively.\n\nCopy: 'No streak flames. No guilt. Just the\ntruth about your memory, and a plan for it.'"],

    ["4 · THE PLAN", T.amber, [
      ["p", "Calendar screenshot: near days"],
      ["p", "concrete, far days faded, projected"],
      ["p", "completion date."],
      ["p", ""],
      ["p", "\"Every day's load, visible in advance."],
      ["p", " The finish date recalculates honestly —"],
      ["p", " we never shorten it to flatter you.\""],
    ], "Answers 'I don't have time' with\nPREDICTABILITY rather than promises.\n\nThis section only became possible once the\ncalendar was promoted to a real surface (§14)."],

    ["5 · OBJECTIONS", T.purple, [
      ["p", "\"My tajwid is weak\" → tapping not"],
      ["p", "  typing; audio per word; EN/MS glosses"],
      ["p", "\"Another streak app?\" → no streaks as a"],
      ["p", "  score, no leaderboards; our metric is"],
      ["p", "  recall in ten years, not opens today"],
      ["p", "\"Which surahs?\" → you choose, we"],
      ["p", "  recommend; each has a structure map"],
    ], "Three short Q&A rows. Each objection is a\nREAL one from the target ICP, answered with a\nfeature that already exists — no vapourware."],

    ["6 · PROOF WITHOUT USERS", T.teal, [
      ["p", "① The science — Ebbinghaus decay curve,"],
      ["p", "    cited; FSRS open algorithm, linked"],
      ["p", "② Builder's note, first person:"],
      ["p", "    \"I memorized Al-Mulk twice and lost"],
      ["p", "     it twice. This is the app I needed"],
      ["p", "     the third time.\""],
      ["p", "③ Open build log / public metrics"],
    ], "NO FAKE TESTIMONIALS, EVER.\nIf a waitlist count is real, show it plain;\notherwise show nothing.\n\nFor this subject matter, a fabricated review\nis not just a growth tactic — it is a lie\nabout the Quran's learners."],

    ["7 · PRICING  (v3-D07 — hard paywall)", T.amber, [
      ["p", "\"Try one surah free. Then RM20 a month.\""],
      ["p", ""],
      ["p", "TRIAL     one surah, or 14 days"],
      ["p", "MONTHLY   RM20 (MY IP)  ·  USD10 (intl)"],
      ["p", "LIFETIME  RM500 (MY IP) ·  USD200 (intl)"],
      ["p", ""],
      ["p", "IP sets the DEFAULT; the learner can change it."],
    ], "SUPERSEDES the waqf/donation model.\nThe old copy — \"Free to memorize. Free to keep,\nsame features either way\" — is now FALSE and had\nto change in the same commit.\n\nLifetime ÷ monthly = 25 months (MY) / 20 (intl).\nThat is a real bet on retention: it only pays if\nlearners stay past ~2 years, which IS the product\nthesis. Price it deliberately, not by accident."],

    ["8 · FOOTER", T.muted, [
      ["p", "\"No ads. No selling data. No dark patterns."],
      ["p", " No guilt notifications. You pay us, so you"],
      ["p", " are the customer — not the product.\""],
      ["p", ""],
      ["p", "FSRS method · open metrics · privacy"],
      ["p", "contact · EN/MS toggle"],
    ], "The ethics list is a CONVERSION asset for\nthis audience, not boilerplate."],
  ];

  sections.forEach(([title, col, lines, why]) => {
    const h = Math.max(120, lines.length * 18 + 54);
    rect(lx, ly, lw, h, { strokeColor: col, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
    text(lx + 16, ly + 12, title, { fontSize: 13, strokeColor: col });
    line([[lx, ly + 34], [lx + lw, ly + 34]], { strokeColor: T.border });
    lines.forEach(([kind, t], i) => {
      text(lx + 16, ly + 44 + i * 18, t, {
        fontSize: kind === "h" ? 15 : kind === "cta" ? 11 : 10,
        strokeColor: kind === "h" ? T.ink : kind === "cta" ? col : T.sec,
      });
    });
    rect(lx + lw + 20, ly, 420, h, { strokeColor: T.border, backgroundColor: T.surface, fillStyle: "solid" });
    text(lx + lw + 36, ly + 12, "WHY", { fontSize: 9, strokeColor: T.muted });
    text(lx + lw + 36, ly + 30, why, { fontSize: 11, strokeColor: T.sec });
    ly += h + 14;
  });

  note(1060, 19240, 380, "A/B TEST FIRST\n1. Hero headline — LOSS-framed (\"You memorized\n   it. Do you still have it?\") vs MECHANISM-\n   framed (\"Keep every surah you memorize\").\n2. Demo ABOVE vs BELOW the mechanism section.\n\nPRIMARY CONVERSION METRIC:\n  demo-qualified starts — visitors who COMPLETE\n  the inline reconstruction AND tap the CTA.\n\nDownstream north star: D1 GATE-PASS RATE of\nonboarded users.\n\nExplicitly NOT: email captures, raw taps,\nsignups. Those reward a landing page that\nlies.", { strokeColor: T.purple, bg: T.purpleBg, fg: "#332a66" });

  note(1060, 19560, 380, "\"SURELY CONVERT\" — the honest version\nNo landing page surely converts, and the\ntactics that promise it (fake urgency,\ninvented scarcity, borrowed testimonials)\nare exactly the ones that would be haram\nhere and would poison trust with this ICP.\n\nWhat this page does instead is remove every\nreason to disbelieve: it lets you DO the\nthing before asking anything, cites its\nscience, shows its real numbers, and states\nits ethics. That is the highest-converting\nhonest page available.", { strokeColor: T.coral, bg: T.coralBg, fg: "#712b13" });

  note(1060, 19900, 380, "CONSISTENCY CHECK — every claim on this page\nis backed by a surface in this wireframe:\n  · demo → §5 quiz loop\n  · overnight gate → §8 scheduling\n  · half-life / decay → §10 monitoring\n  · calendar → §14\n  · structure map → §3 macro panel\n  · EN/MS glosses → v2-D27\n\nNothing here is vapourware. A landing page\nthat promises what the app doesn't do is the\nfastest way to lose this audience.", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });
}

// ============================================================
// 19 · SOCIAL — LEARNER UI
// ============================================================
sectionTitle(80, 21100, "19", "Social & motivation — learner UI", "Every surface flag-gated, OFF by default. Friends see CONSISTENCY ONLY — never strength, lapses or half-life.");

// 19a — profile
const s1 = phone(120, 21260, "You — profile", "flag: profile", { h: 600 });
{
  const { x, w } = s1.inner;
  let y = s1.y + 44;

  // avatar = geometric pattern, no faces
  ellipse(x, y, 56, 56, { strokeColor: T.purple, backgroundColor: T.purpleBg, fillStyle: "solid", strokeWidth: 2 });
  text(x + 16, y + 20, "✧", { fontSize: 20, strokeColor: T.purple });
  text(x + 68, y + 10, "Firdaus", { fontSize: 15 });
  text(x + 68, y + 32, "@firdaus", { fontSize: 10, strokeColor: T.muted });
  y += 74;

  rect(x, y, w, 74, { strokeColor: T.teal, backgroundColor: T.tealBg, fillStyle: "solid", strokeWidth: 2 });
  text(x + 12, y + 10, "9.4 days", { fontSize: 22, strokeColor: "#085041" });
  text(x + 12, y + 38, "before you'd forget half", { fontSize: 10, strokeColor: T.sec });
  text(x + 12, y + 55, "132 ayat retained long-term", { fontSize: 10, strokeColor: T.sec });
  y += 86;
  text(x, y, "Day 41", { fontSize: 11, strokeColor: T.muted });
  y += 28;

  rect(x, y, w, 78, { strokeColor: T.purple, backgroundColor: T.white, fillStyle: "solid" });
  text(x + 10, y + 8, "FRIENDS CAN SEE", { fontSize: 9, strokeColor: T.purple });
  text(x + 10, y + 24, "· that you showed up today\n· your streak\n· surahs you're working on", { fontSize: 10, strokeColor: T.sec });
  y += 90;

  rect(x, y, w, 74, { strokeColor: T.coral, backgroundColor: T.coralBg, fillStyle: "solid" });
  text(x + 10, y + 8, "ONLY YOU CAN SEE", { fontSize: 9, strokeColor: "#712b13" });
  text(x + 10, y + 24, "· word strength   · slips\n· half-life       · everything else", { fontSize: 10, strokeColor: T.sec });
  y += 88;

  ["Companions (6)", "Invite a friend", "Streak calendar", "Notification settings"].forEach((l) => {
    text(x, y, "› " + l, { fontSize: 11, strokeColor: T.sec });
    y += 22;
  });
}

// 19b — companions
const s2 = phone(500, 21260, "Companions", "flag: social.friends", { h: 600 });
{
  const { x, w } = s2.inner;
  let y = s2.y + 44;

  text(x, y, "Sorted A–Z — never by streak", { fontSize: 10, strokeColor: T.coral });
  y += 26;

  [["Ahmad", true, "Day 87", "Al-Mulk", true],
   ["Maryam", true, "Day 12", "Yusuf", false],
   ["Nurul", false, "Day 5", "An-Naba", false],
   ["Zaid", false, "Day 63", "Al-Kahf", false]].forEach(([n, today, d, s, tog]) => {
    rect(x, y, w, 62, { strokeColor: T.border });
    ellipse(x + 10, y + 14, 34, 34, { strokeColor: T.purple, backgroundColor: T.purpleBg, fillStyle: "solid" });
    text(x + 22, y + 25, "✧", { fontSize: 12, strokeColor: T.purple });
    text(x + 54, y + 10, n, { fontSize: 12 });
    // showed-up dot: filled teal or HOLLOW muted — never coral
    ellipse(x + w - 26, y + 12, 14, 14, {
      strokeColor: today ? T.teal : T.muted,
      backgroundColor: today ? T.teal : T.white,
      fillStyle: "solid",
    });
    text(x + 54, y + 28, d + "  ·  " + s, { fontSize: 9, strokeColor: T.muted });
    if (tog) chip(x + 54, y + 42, "Together · Day 12", { fontSize: 8, strokeColor: T.teal, fg: T.teal });
    y += 70;
  });

  y += 4;
  rect(x, y, w, 56, { strokeColor: T.teal, backgroundColor: T.tealBg, fillStyle: "solid" });
  text(x + 10, y + 8, "● showed up today", { fontSize: 10, strokeColor: T.teal });
  text(x + 10, y + 26, "○ no session yet — neutral,\n   never coral, never \"missed\"", { fontSize: 9, strokeColor: T.sec });
}

// 19c — together-streak
const s3 = phone(880, 21260, "Together-streak", "flag: social.togetherStreak", { h: 600 });
{
  const { x, w } = s3.inner;
  let y = s3.y + 44;

  rect(x, y, w, 92, { strokeColor: T.teal, backgroundColor: T.tealBg, fillStyle: "solid", strokeWidth: 2 });
  ellipse(x + 14, y + 24, 42, 42, { strokeColor: T.purple, backgroundColor: T.white, fillStyle: "solid" });
  ellipse(x + 44, y + 24, 42, 42, { strokeColor: T.purple, backgroundColor: T.white, fillStyle: "solid" });
  text(x + 100, y + 22, "You and Maryam", { fontSize: 13, strokeColor: "#085041" });
  text(x + 100, y + 44, "Day 12 together", { fontSize: 15, strokeColor: "#085041" });
  y += 108;

  text(x, y, "WHEN EITHER PERSON LAPSES", { fontSize: 9, strokeColor: T.muted });
  y += 20;
  rect(x, y, w, 96, { strokeColor: T.amber, backgroundColor: T.amberBg, fillStyle: "solid", strokeWidth: 2 });
  text(x + 12, y + 10, "\"Paused — it resumes when\nyou both return.\"", { fontSize: 12, strokeColor: "#7a4d0d" });
  text(x + 12, y + 50, "The UI NEVER says who missed.\nNO notification is sent to the\nother person about the pause.", { fontSize: 9, strokeColor: T.sec });
  y += 110;

  text(x, y, "IDOLATRY BRAKE — day 40+", { fontSize: 9, strokeColor: T.muted });
  y += 18;
  rect(x, y, w, 62, { strokeColor: T.border, backgroundColor: T.white, fillStyle: "solid" });
  text(x + 12, y + 8, "\"214 days you've shown up", { fontSize: 12 });
  text(x + 12, y + 26, " for each other, total.\"", { fontSize: 12 });
  text(x + 12, y + 44, "the streak number shrinks to a caption", { fontSize: 8, strokeColor: T.muted });
  y += 76;

  text(x, y, "› Gently close this streak", { fontSize: 10, strokeColor: T.muted });
  text(x, y + 18, "  ends silently · no reason, no attribution", { fontSize: 8, strokeColor: T.muted });
}

note(1260, 21260, 380, "★ THE FRIEND-STREAK PROBLEM, SOLVED AT THE\nDATA LAYER — not with polite copy.\n\nA shared streak normally makes ANOTHER\nPERSON'S LAPSE YOUR LOSS. That is the exact\nmechanic that manufactures guilt, and guilt is\nwhat sabr jameel exists to prevent.\n\nThe fix: when either person lapses the state\nis simply \"Paused — it resumes when you both\nreturn.\" The UI never says who missed, and the\nother person is NEVER NOTIFIED.\n\nStructurally invisible beats politely worded.\nThere is no copy to get wrong later.", { strokeColor: T.coral, bg: T.coralBg, fg: "#712b13" });

note(1260, 21580, 380, "AVATARS ARE GEOMETRIC PATTERNS\n24 khatam / 8-point-star / arabesque tiles in 6\ncolourways. NO photos, NO faces, NO creature\nmascots — aniconism-safe BY CONSTRUCTION\nrather than by moderation.\n\nThis also removes an entire moderation category\n(inappropriate profile photos) before it can\nexist.", { strokeColor: T.purple, bg: T.purpleBg, fg: "#332a66" });

note(1260, 21800, 380, "FRIENDS LIST SORTS ALPHABETICALLY — never by\nstreak. One sort order is the difference\nbetween a companions list and a leaderboard.\n\nAnd the \"no session yet\" marker is a HOLLOW\nMUTED circle, never coral. Coral is reserved\nfor slips; using it for \"hasn't shown up today\"\nwould turn a neighbour's ordinary Tuesday into\na visible failure.", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

// 19d — streak calendar + freeze + XP
const s4 = phone(120, 21960, "Streak calendar", "flag: streaks.calendar", { h: 620 });
{
  const { x, w } = s4.inner;
  let y = s4.y + 44;

  text(x, y, "August", { fontSize: 14 });
  y += 26;
  ["M", "T", "W", "T", "F", "S", "S"].forEach((d, i) => text(x + 6 + i * 38, y, d, { fontSize: 9, strokeColor: T.muted }));
  y += 16;
  // 0 reviewed, 1 covered(freeze), 2 repaired, 3 paused, 4 empty
  const cal = [0,0,1,0,0,3,0, 0,0,0,2,0,0,0, 0,3,0,0,0,0,0, 0,0,0,0,4,4,4];
  cal.forEach((k, i) => {
    const cx2 = x + (i % 7) * 38, cy2 = y + Math.floor(i / 7) * 38;
    if (k === 0) rect(cx2, cy2, 32, 32, { strokeColor: T.teal, backgroundColor: T.teal, fillStyle: "solid", sharp: true });
    if (k === 1) rect(cx2, cy2, 32, 32, { strokeColor: T.teal, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2, sharp: true });
    if (k === 2) { rect(cx2, cy2, 32, 32, { strokeColor: T.teal, backgroundColor: T.teal, fillStyle: "solid", sharp: true }); rect(cx2 + 24, cy2, 8, 8, { strokeColor: T.white, backgroundColor: T.white, fillStyle: "solid", sharp: true }); }
    if (k === 3) rect(cx2, cy2, 32, 32, { strokeColor: T.muted, strokeStyle: "dotted", sharp: true });
    if (k === 4) rect(cx2, cy2, 32, 32, { strokeColor: T.border, sharp: true });
  });
  y += 4 * 38 + 14;

  [["■ Reviewed", T.teal], ["□ Rest day, covered", T.teal], ["◪ Repaired (make-up)", T.teal], ["⬚ Paused — held, not lost", T.muted]].forEach((l, i) => {
    text(x, y + i * 17, l[0], { fontSize: 9, strokeColor: l[1] });
  });
  y += 78;

  rect(x, y, w, 44, { strokeColor: T.teal, backgroundColor: T.tealBg, fillStyle: "solid" });
  text(x + 10, y + 8, "Day 41 · paused twice, repaired once", { fontSize: 11, strokeColor: "#085041" });
  text(x + 10, y + 26, "— still yours.", { fontSize: 11, strokeColor: "#085041" });
  y += 58;

  text(x, y, "NO CORAL ANYWHERE ON THIS GRID.", { fontSize: 9, strokeColor: T.coral });
  text(x, y + 15, "Misses are quiet, not wounds.", { fontSize: 9, strokeColor: T.muted });
}

const s5 = phone(500, 21960, "Rest-day cover + points", "flags: streaks.freeze · xp", { h: 620 });
{
  const { x, w } = s5.inner;
  let y = s5.y + 44;

  text(x, y, "REST-DAY COVERS", { fontSize: 9, strokeColor: T.muted });
  y += 18;
  rect(x, y, w, 104, { strokeColor: T.teal, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
  text(x + 12, y + 10, "2 of 2", { fontSize: 16, strokeColor: T.teal });
  ellipse(x + 100, y + 8, 22, 22, { strokeColor: T.teal, strokeWidth: 2 });
  ellipse(x + 128, y + 8, 22, 22, { strokeColor: T.teal, strokeWidth: 2 });
  text(x + 12, y + 38, "\"Every 7 days you show up, you earn\none cover. If you miss a day, a cover\nis used FOR you — nothing to activate,\nnothing to buy. You can hold two.\"", { fontSize: 9, strokeColor: T.sec });
  y += 120;

  rect(x, y, w, 44, { strokeColor: T.border, backgroundColor: T.surface, fillStyle: "solid" });
  text(x + 10, y + 8, "\"Yesterday was covered for you.", { fontSize: 10, strokeColor: T.sec });
  text(x + 10, y + 25, " Rest is part of the path.\"", { fontSize: 10, strokeColor: T.sec });
  y += 62;

  text(x, y, "REVIEW POINTS", { fontSize: 9, strokeColor: T.muted });
  y += 18;
  rect(x, y, w, 132, { strokeColor: T.border, backgroundColor: T.white, fillStyle: "solid" });
  text(x + 12, y + 10, "1,240 pts", { fontSize: 13, strokeColor: T.muted });
  text(x + 12, y + 34, "+10 per review answered honestly\n     — right OR wrong, identical", { fontSize: 9, strokeColor: T.teal });
  text(x + 12, y + 66, "+25 finishing the daily plan\nZERO points for speed\nDaily cap = one full session", { fontSize: 9, strokeColor: T.sec });
  text(x + 12, y + 112, "above 10,000 → renders as \"10k+\"", { fontSize: 8, strokeColor: T.muted });
  y += 148;

  rect(x, y, w, 46, { strokeColor: T.purple, backgroundColor: T.purpleBg, fillStyle: "solid" });
  text(x + 10, y + 8, "Every 500 pts plants a tree", { fontSize: 11, strokeColor: "#332a66" });
  text(x + 10, y + 26, "via a named waqf partner.", { fontSize: 9, strokeColor: T.sec });
}

const s6 = phone(880, 21960, "Word Care", "flag: wordInsights · inside Progress", { h: 620 });
{
  const { x, w } = s6.inner;
  let y = s6.y + 44;

  text(x, y, "Words asking for your attention", { fontSize: 13 });
  text(x, y + 20, "Your review plan already includes all of\nthese. Nothing extra to do.", { fontSize: 9, strokeColor: T.muted });
  y += 54;

  text(x, y, "TENDING", { fontSize: 9, strokeColor: T.muted });
  y += 20;
  [["يَقُولُونَ", "they say"], ["ٱلْمُلْكُ", "the dominion"]].forEach(([a, g]) => {
    rect(x, y, w, 50, { strokeColor: T.border });
    text(x + 12, y + 10, a, { fontSize: 17 });
    text(x + 12, y + 34, g, { fontSize: 9, strokeColor: T.purple });
    ellipse(x + w - 26, y + 20, 10, 10, { strokeColor: T.coral, backgroundColor: T.coral, fillStyle: "solid" });
    text(x + w - 130, y + 34, "slipped 3 of last 4", { fontSize: 8, strokeColor: T.muted });
    y += 58;
  });
  y += 6;

  text(x, y, "OFTEN SWAPPED", { fontSize: 9, strokeColor: T.muted });
  y += 20;
  rect(x, y, w, 76, { strokeColor: T.purple, backgroundColor: T.purpleBg, fillStyle: "solid" });
  text(x + 14, y + 10, "يَقُولُونَ", { fontSize: 16 });
  text(x + 130, y + 10, "يَقُولُ", { fontSize: 16 });
  text(x + 14, y + 38, "\"These two trade places in your mind.\nTheir meanings: 'they say' / 'he says'.\"", { fontSize: 9, strokeColor: T.sec });
  y += 90;

  text(x, y, "GETTING STEADIER", { fontSize: 9, strokeColor: T.teal });
  y += 18;
  rect(x, y, w, 44, { strokeColor: T.teal, backgroundColor: T.tealBg, fillStyle: "solid" });
  text(x + 12, y + 8, "ٱلَّذِى", { fontSize: 14, strokeColor: "#085041" });
  text(x + 12, y + 28, "quicker each week — settling in", { fontSize: 9, strokeColor: T.sec });
  y += 58;

  text(x, y, "\"This page is yours alone.\n Companions never see it.\"", { fontSize: 9, strokeColor: T.muted });
}

note(1260, 21960, 380, "POINTS THAT CANNOT BECOME THE GOAL\n+10 for a review answered HONESTLY — right or\nwrong, identical. That single rule kills the\nincentive to fake mastery, which is the exact\nfailure mode §10's retention-honesty rule\nexists to prevent.\n\nZero points for speed. Daily cap = one full\nsession, so the satiety cap makes bingeing\nworthless.\n\nAnd points buy only modest cosmetics + a waqf\ntree. Explicitly forbidden: leaderboards,\npurchases, multipliers, friend comparison,\npoint decay, gating any learning content.", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

note(1260, 22300, 380, "NOTIFICATIONS — the dignified alternative\nOne learner-set window (default 30 min after\ntheir median session time). Max 1/day, 5/week.\nAlgorithmic types are RANKED and only the top\none sends.\n\n\"3 ayat in An-Naba are slipping. A short review\ntoday would hold them.\"\n\"Your memory of Al-Mulk now holds for 14 days —\ndouble last month.\"\n\"Your streak is paused, not lost. One session\ntoday repairs yesterday.\"  ← sent NEXT WINDOW,\n                              never same-night\n\nFORBIDDEN: countdowns · \"dies/lose/last chance\"\n· red badges · sending outside the window.", { strokeColor: T.amber, bg: T.amberBg, fg: "#7a4d0d" });

note(1260, 22640, 380, "\"WORD CARE\", not a report card\nSame data a grading UI would show — per-word\nfailure, confusion pairs, latency — but framed\nas TENDING, with the fix already scheduled.\n\nNo percentages. No scores. No red text. The\nonly coral on the screen is a single small dot.\n\nAnd it ALWAYS shows a \"getting steadier\"\nsection: if nothing is improving it says\n\"Every word here is either settling or being\ntended. Well kept.\" A diagnostic screen that\ncan only ever accuse is one people stop\nopening.", { strokeColor: T.purple, bg: T.purpleBg, fg: "#332a66" });

// ============================================================
// 20 · SOCIAL — ADMIN CONTROL PLANE
// ============================================================
sectionTitle(80, 22900, "20", "Social & gamification — admin control plane", "Enabling is SLOW. Killing is FAST. The asymmetry is the design.");

const NAV2 = ["Overview", "Users", "System Health", "Learning Science", "— Social —", "Feature Flags", "Invite Codes", "Moderation", "Notifications", "Gamification Health", "Word Analytics", "Qari Review", "Audit Log"];

// 20a — feature flags
{
  const d = desktop(120, 23040, 1180, 470, "Feature Flags", "one on/off plane for every social feature — all OFF by default", { url: "iman.app/admin/flags" });
  sidebarNav(d, NAV2, "Feature Flags");
  const c = d.content;

  chip(c.x + 14, d.y + 44, "PROD", { fontSize: 9, strokeColor: T.amber, fg: T.amber, bg: T.amberBg });
  chip(c.x + 70, d.y + 44, "last fold check 100% ✓", { fontSize: 9, strokeColor: T.teal, fg: T.teal });
  text(c.x + c.w - 160, d.y + 49, "View flag audit trail →", { fontSize: 9, strokeColor: T.muted });

  const cols = [["FEATURE", 200], ["STATE", 90], ["ROLLOUT", 120], ["EXPOSED", 80], ["ETHICS NOTE (fixed, non-editable)", 330], ["LAST CHANGED", 130], ["", 60]];
  const rows = [
    ["friend_streaks", ["OFF", T.muted], "off", "0", ["highest-risk: another's lapse = your loss", T.coral], "—", ["KILL", T.coral]],
    ["add_friends", ["OFF", T.muted], "off", "0", "blocking + report required before enable", "—", ["KILL", T.coral]],
    ["invite_codes", ["RAMPING", T.amber], "12% of users", "154", "caps: 500/batch, 2 batches/admin/day", "u_admin_k2 · 08-07", ["KILL", T.coral]],
    ["friend_progress_visibility", ["OFF", T.muted], "off", "0", ["CONSISTENCY-ONLY: strength/lapses/half-life NEVER exposed", T.purple], "—", ["KILL", T.coral]],
    ["points_xp", ["OFF", T.muted], "off", "0", "idolatry brake: number shrinks as it grows", "—", ["KILL", T.coral]],
    ["streak_freeze", ["ON", T.teal], "100%", "1,284", "auto-applies — never a panic purchase", "u_admin_r8 · 07-30", ["KILL", T.coral]],
    ["streak_calendar", ["ON", T.teal], "100%", "1,284", "facts only; length de-emphasised", "u_admin_r8 · 07-30", ["KILL", T.coral]],
    ["algo_notifications", ["OFF", T.muted], "off", "0", ["templates need dark-pattern sign-off (20c)", T.amber], "—", ["KILL", T.coral]],
    ["word_perf_monitoring", ["ON", T.teal], "cohort: beta_my", "312", "aggregate only, n≥50 cells", "u_admin_k2 · 08-02", ["KILL", T.coral]],
  ];
  table(c.x + 14, c.y + 16, c.w - 28, cols, rows, { rowH: 24 });

  rect(c.x + 14, d.y + d.h - 68, c.w - 28, 40, { strokeColor: T.ink, backgroundColor: T.surface, fillStyle: "solid", strokeWidth: 2 });
  text(c.x + 26, d.y + d.h - 58, "ASYMMETRY BY DESIGN — enabling requires an ethics checklist + typed feature name; KILLING requires one click.", { fontSize: 11 });
  text(c.x + 26, d.y + d.h - 42, "A kill fires an alert, bypasses the ramp, and pins a banner until a SECOND admin acknowledges it.", { fontSize: 10, strokeColor: T.muted });
}

note(1330, 23040, 360, "\"ENABLE IS HARD, KILL IS EASY\"\nThe best idea in this spec.\n\nRamping to 100% needs: a reason ≥20 chars, two\nticked ethics boxes (\"introduces no loss-framed\nmechanic\", \"satiety cap still enforced\"), AND\ntyping the feature name verbatim.\n\nKilling needs one click and a reason.\n\nMost feature-flag UIs make both symmetric. That\nis how a dark pattern stays live over a weekend\nbecause turning it off required a deploy.", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

note(1330, 23360, 360, "COLOUR DISCIPLINE HOLDS\nOFF renders MUTED, never coral. Coral is\nreserved for errors and harm — using it for\n\"disabled\" would make the safe default look\nbroken and quietly pressure operators to turn\nthings on.\n\nSmall detail, real consequence.", { strokeColor: T.purple, bg: T.purpleBg, fg: "#332a66" });

// 20b — moderation + invites
{
  const d = desktop(120, 23600, 1180, 430, "Invite codes · Moderation", "police the social graph without ever opening learning data", { url: "iman.app/admin/moderation" });
  sidebarNav(d, NAV2, "Moderation");
  const c = d.content;

  // invites
  text(c.x + 14, c.y + 10, "INVITE CODES — format  iman-XXXX-XXXX", { fontSize: 11, strokeColor: T.muted });
  [["Active codes", "1,204"], ["Redemptions 7d", "312"], ["Abuse flags open", "3"]].forEach(([l, v], i) => {
    tile(c.x + 14 + i * 180, c.y + 28, 170, 46, l, v, "", { valueSize: 16, fg: i === 2 ? T.coral : T.ink });
  });
  text(c.x + 14, c.y + 88, "AUTO-FLAG RULES: >20 codes by one learner/24h · >10 redemptions from distinct IP /16s in 1h · code string found on the public web", {
    fontSize: 9, strokeColor: T.amber,
  });

  // moderation case
  text(c.x + 14, c.y + 112, "MODERATION CASE — what an operator may and may not see", { fontSize: 11, strokeColor: T.muted });
  rect(c.x + 14, c.y + 130, 540, 170, { strokeColor: T.teal, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
  text(c.x + 26, c.y + 140, "CAN SEE", { fontSize: 11, strokeColor: T.teal });
  text(c.x + 26, c.y + 160, "· the report reason written by the reporter\n· the friend-request message itself (the reported content)\n· behavioural counts — \"41 requests sent /7d, 3 prior reports\"\n· invite-graph metadata\n· pseudonyms only: u_9c1d… → u_7f3a…", { fontSize: 10, strokeColor: T.sec });

  rect(c.x + 570, c.y + 130, 540, 170, { strokeColor: T.coral, backgroundColor: T.coralBg, fillStyle: "solid", strokeWidth: 2 });
  text(c.x + 582, c.y + 140, "CANNOT SEE", { fontSize: 11, strokeColor: "#712b13" });
  text(c.x + 582, c.y + 160, "· real identity (except impersonation cases, audited)\n· ANY Quran progress or memorization data\n· strength, lapses, half-life, weak ayat\n· message history beyond the reported item", { fontSize: 10, strokeColor: T.sec });
  text(c.x + 582, c.y + 246, "\"Moderation never opens learning data.\"", { fontSize: 11, strokeColor: "#712b13" });

  text(c.x + 14, c.y + 312, "ACTIONS:  Warn  ·  Block pair (silent, both directions)  ·  Suspend SOCIAL features only  ·  Dismiss", { fontSize: 11 });
  text(c.x + 14, c.y + 330, "“Suspend social” leaves full SRS access intact — we never take away someone's Quran review. Suspensions >7d need a second admin's co-sign.", {
    fontSize: 10, strokeColor: T.teal,
  });
}

// 20c — notification governance + gamification health
{
  const d = desktop(120, 24120, 1180, 480, "Notification governance · Gamification health", "no template ships without a dark-pattern sign-off; no feature survives without retention proof", { url: "iman.app/admin/notifications" });
  sidebarNav(d, NAV2, "Notifications");
  const c = d.content;

  const cols = [["TEMPLATE ID", 170], ["TRIGGER", 210], ["FREQ CAP", 160], ["STATE", 110], ["SENDS 7d", 80], ["OPT-OUT", 90], ["SIGNED OFF BY", 140]];
  const rows = [
    ["ntf_review_due", "review_queue ≥ 5 due", "1/day · quiet 21:00–08:00", ["APPROVED", T.teal], "8,412", ["0.4%", T.teal], "u_admin_k2 · 07-30"],
    ["ntf_gentle_return", "inactive 3d", "1/week", ["APPROVED", T.teal], "1,204", ["1.1%", T.teal], "u_admin_r8 · 07-28"],
    ["ntf_streak_freeze_used", "freeze auto-applied", "on event", ["APPROVED", T.teal], "342", ["0.2%", T.teal], "u_admin_k2 · 08-01"],
    ["ntf_halflife_win", "half-life doubled on a surah", "2/week", ["DP-REVIEW", T.amber], "0", ["—", T.muted], "—"],
    ["ntf_friend_joined", "friend accepted request", "2/week", ["DRAFT", T.muted], "0", ["—", T.muted], "—"],
    ["ntf_streak_at_risk", "streak atRisk after 20:00", "—", ["RETIRED", T.coral], "0", ["4.2%", T.coral], "AUTO-PAUSED at 3%"],
  ];
  table(c.x + 14, c.y + 16, c.w - 28, cols, rows, { rowH: 24 });

  rect(c.x + 14, c.y + 180, 540, 116, { strokeColor: T.amber, backgroundColor: T.amberBg, fillStyle: "solid", strokeWidth: 2 });
  text(c.x + 26, c.y + 190, "DARK-PATTERN REVIEW GATE — 5 checks, any FAIL blocks approval", { fontSize: 11, strokeColor: "#7a4d0d" });
  text(c.x + 26, c.y + 210, "1  Not loss-framed — no \"don't lose your streak\", no countdown\n2  No guilt or shame language\n3  Respects satiety — never prompts a learner already at today's cap\n4  Honest claim — copy matches what the SRS actually predicts\n5  Silence-positive — has a defined condition where it does NOT send", {
    fontSize: 10, strokeColor: T.sec,
  });
  text(c.x + 26, c.y + 286, "The author may NEVER self-approve.", { fontSize: 10, strokeColor: T.coral });

  rect(c.x + 570, c.y + 180, 540, 116, { strokeColor: T.coral, backgroundColor: T.coralBg, fillStyle: "solid", strokeWidth: 2 });
  text(c.x + 582, c.y + 190, "THE SHUTDOWN RULE — pre-committed, in the UI", { fontSize: 11, strokeColor: "#712b13" });
  text(c.x + 582, c.y + 212, "\"TURN IT OFF when, at 90 days with adequate power:\n P(recall@10y) Δ ≤ 0 while ANY engagement metric Δ > 0.\n Engagement without retention is addiction, not learning.\n NEUTRAL at 180 days → also OFF (complexity is a cost).\"", {
    fontSize: 10, strokeColor: T.sec,
  });
  text(c.x + 582, c.y + 286, "ntf_streak_at_risk was retired by exactly this rule.", { fontSize: 10, strokeColor: "#712b13" });

  // cohort table
  text(c.x + 14, c.y + 310, "GAMIFICATION HEALTH — matched holdouts. No DAU, no session counts, by design.", { fontSize: 11, strokeColor: T.muted });
  const cols2 = [["FEATURE", 190], ["ON (n)", 90], ["OFF (n)", 90], ["D30 RETENTION Δ", 190], ["P(RECALL@10Y) Δ  ← decisive", 260], ["VERDICT", 120]];
  const rows2 = [
    ["points_xp", "2,140", "2,098", "+2.1pp  CI [−0.4, +4.6]", "+0.1pp  CI [−0.9, +1.1]", ["NEUTRAL", T.muted]],
    ["friend_streaks", "1,020", "1,011", "+6.4pp  CI [+3.1, +9.7]", ["−1.2pp  CI [−2.1, −0.3]", T.coral], ["HARMS", T.coral]],
    ["streak_calendar", "2,140", "2,098", "+1.8pp  CI [+0.2, +3.4]", ["+0.8pp  CI [+0.1, +1.5]", T.teal], ["HELPS", T.teal]],
    ["algo_notifications", "912", "903", "+3.0pp  CI [−1.2, +7.2]", "insufficient power", ["UNDERPOWERED", T.amber]],
  ];
  table(c.x + 14, c.y + 330, c.w - 28, cols2, rows2, { rowH: 24 });
}

note(1330, 24120, 360, "THE ROW THAT JUSTIFIES THE WHOLE SCREEN\nfriend_streaks:  D30 retention +6.4pp\n                 P(recall@10y) −1.2pp\n\nEngagement UP, actual memory DOWN. People come\nback more and remember LESS — the shared streak\npulls them into cramming sessions that satisfy\nthe streak without spacing the retrieval.\n\nOn a DAU dashboard this feature looks like a\nwin and ships to 100%. On THIS dashboard it is\nmarked HARMS and killed.\n\nThat is the entire argument for measuring\nP(recall@10y) instead of engagement.", { strokeColor: T.coral, bg: T.coralBg, fg: "#712b13" });

note(1330, 24560, 360, "STREAK IDOLATRY MONITOR\n\"% of sessions in the last 2h before local\nmidnight\", per cohort, amber line at 15%.\n\nA midnight-cramming spike in streak cohorts is\nthe measurable signature of streak idolatry —\ndrilling to protect a number rather than to\nremember. Triggers an auto-alert.\n\nTurns a values statement into a METRIC — the\nsame move fold_determinism_check makes for\ninvariant #2.", { strokeColor: T.amber, bg: T.amberBg, fg: "#7a4d0d" });

// ============================================================
// 21 · BUILD ORDER
// ============================================================
// ============================================================
// 21 · CAN YOU MEMORIZE A PAGE / SURAH BY ONLY PLAYING THE QUIZ?
// ============================================================
sectionTitle(80, 24800, "21", "Can the quiz alone memorize a page?", "The honest answer, from the engine's own numbers. Measured, not claimed.");

{
  const y0 = 24940;

  // THE VERDICT
  rect(80, y0, 1350, 130, { strokeColor: T.amber, backgroundColor: T.amberBg, fillStyle: "solid", strokeWidth: 3 });
  text(100, y0 + 14, "VERDICT — mostly yes, with one real gap", { fontSize: 18, strokeColor: "#7a4d0d" });
  text(100, y0 + 46, "The quiz alone can take you to CUED RECALL of a full page: every word produced in order, from a blank ayah.\nIt cannot, today, prove FREE RECALL — reciting from memory with nothing on screen. The word bank is always present.\nThat gap is one unbuilt feature (v2-D05's deferred \"hard mode\"), not a flaw in the method.", {
    fontSize: 13, strokeColor: T.ink,
  });

  // The ladder of recall
  const ly = y0 + 160;
  text(80, ly, "THE LADDER OF RECALL — how far each drill actually takes you", { fontSize: 15 });
  const rungs = [
    ["S1", "meaning", "Recognition", "Pick the gloss of a lit word from 4.\nWeakest evidence — you'd know it in a list.", T.muted, 0.2],
    ["S2", "fill one blank", "Cued recall", "One word hidden, tap it from 4 options.\nThe ayah around it is the cue.", T.amber, 0.45],
    ["RC", "reconstruct", "Cued recall, scaling", "Blanks grow with strength: 1 → half → ALL.\nThe hidden tail advances toward the front.", T.teal, 0.7],
    ["S3 / gate", "produce whole", "Cued production", "EVERY word blanked, tapped in order, cold,\non a fresh day. This is the real bar.", T.teal, 0.9],
    ["—", "free recall", "NOT BUILT", "Recite with NOTHING on screen. No bank,\nno options. The one rung that is missing.", T.coral, 1.0],
  ];
  let ry = ly + 26;
  rungs.forEach(([r, n, kind, d, col, frac]) => {
    const h = 68;
    rect(80, ry, 900, h, { strokeColor: col, backgroundColor: r === "—" ? T.coralBg : T.white, fillStyle: "solid", strokeWidth: 2 });
    text(96, ry + 12, r, { fontSize: 15, strokeColor: col });
    text(150, ry + 12, n, { fontSize: 13 });
    text(150, ry + 34, d, { fontSize: 10, strokeColor: T.sec });
    chip(700, ry + 10, kind, { fontSize: 9, strokeColor: col, fg: col });
    // strength-of-evidence bar
    rect(700, ry + 40, 180, 10, { strokeColor: T.border, sharp: true });
    rect(700, ry + 40, 180 * frac, 10, { strokeColor: col, backgroundColor: col, fillStyle: "solid", sharp: true });
    ry += h + 8;
  });

  note(1000, ly + 26, 430, "WHY \"CUED\" IS THE HONEST WORD\nAt Carry band reconstruct.ts blanks the WHOLE\nayah (blankCountFor → total) and the cold gate\nforces `full: true` regardless of band.\n\nSo the learner does produce every word, in\norder, from nothing — on a fresh day, no\nwarm-up. That is genuinely strong.\n\nBUT the words are still TAPPED FROM A BANK.\nSeeing the right word among distractors is\neasier than summoning it unaided. Calling that\n\"you have memorized it\" would overclaim, and\n§10's retention-honesty rule forbids it.", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

  note(1000, ly + 280, 430, "THE MISSING RUNG — already specified, never built\nv2-D05 (2026-07-15) says: \"No Arabic typing\nrequired; an optional HARD MODE accepts typed\nArabic (diacritics forgiven).\"\n\nHard mode was never implemented. It is the only\nthing standing between this app and a provable\n\"I can recite this page.\"\n\nCheaper alternative that needs no keyboard:\nRECITE-AND-REVEAL — show nothing, learner\nrecites aloud from memory, then taps to reveal\nand self-marks. Weaker evidence (self-report,\nso it must be structured:false and move no\nstrength) but it closes the loop honestly.", { strokeColor: T.coral, bg: T.coralBg, fg: "#712b13" });

  // THE NUMBERS
  const ny = ly + 400;
  text(80, ny, "THE ARITHMETIC — one median page, Surah Yusuf (real corpus + real mushaf geometry)", { fontSize: 15 });
  const facts = [
    ["A median page", "8 ayat · 133 words", "Madani 15-line; Yusuf spans p235–248, range 4–11 ayat/page", T.purple],
    ["Taps to first-encode", "~399 graded taps", "133 S1 meaning + 133 S2 fill + 133 S3 in-order production", T.teal],
    ["Time to first-encode", "~44 min of new-Learn", "Appendix A: 0.33 min/word. Spread over days, never one sitting", T.teal],
    ["Days at Steady (1 ayah/day)", "8 days", "one page ≈ 8 days; the cold gate paces it, not you", T.amber],
    ["Days at Sprint (3 ayah/day)", "3 days", "faster intake, heavier review debt — the calendar shows it", T.amber],
    ["Atoms the page creates", "15", "8 ayah atoms + 7 junction atoms (the joints between them)", T.purple],
    ["A full review pass", "~6 min", "0.4 min × 15 atoms — but decay spreads it, never all at once", T.teal],
  ];
  let fy = ny + 26;
  facts.forEach(([l, v, d, col]) => {
    rect(80, fy, 900, 46, { strokeColor: T.border, backgroundColor: T.white, fillStyle: "solid" });
    text(96, fy + 8, l, { fontSize: 12 });
    text(96, fy + 28, d, { fontSize: 9, strokeColor: T.muted });
    text(700, fy + 14, v, { fontSize: 14, strokeColor: col });
    fy += 52;
  });

  note(1000, ny + 150, 430, "WHOLE SURAH YUSUF, same arithmetic\n  111 ayat · 1,777 words · 14 pages\n  ~9.8 HOURS of new-Learn to first-encode\n  221 atoms at the end (111 ayah + 110 joints)\n  Steady 1/day → 111 days · Sprint 3/day → 37\n\nThat is FIRST ENCODE only. Retention is the\nother half, and it never ends — which is the\nwhole thesis of the product.\n\nThe §14 calendar exists precisely so this\nnumber is visible in advance instead of\ndiscovered at month three.", { strokeColor: T.purple, bg: T.purpleBg, fg: "#332a66" });

  note(1000, ny + 390, 430, "WHAT THE QUIZ GENUINELY DOES BETTER THAN\nTRADITIONAL SOLO REVISION\n  · It schedules the joints. Chains/junctions are\n    separate atoms — most learners stall exactly\n    at ayah transitions and never drill them.\n  · It refuses to let you race. The cold gate\n    blocks new ayat until yesterday's hold.\n  · It measures decay honestly instead of the\n    feeling of fluency, which lies.\n  · It forces MEANING (S1) before form, so this\n    is not parrot-memorization.", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

  // What's still needed
  const wy = ny + 420;
  rect(80, wy, 1350, 150, { strokeColor: T.coral, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
  text(100, wy + 14, "TO HONESTLY CLAIM \"MEMORIZE A PAGE BY PLAYING ALONE\", THREE THINGS ARE STILL NEEDED", { fontSize: 15, strokeColor: T.coral });
  text(100, wy + 44, "1   FREE-RECALL RUNG — hard mode (typed, diacritics forgiven) or recite-and-reveal. Without it the app cannot distinguish\n     \"can pick the right word\" from \"can recite\". This is the honest blocker.\n\n2   AUDIO / TAJWID — the app teaches the WORDS and their order. It does not teach pronunciation, madd, or ghunnah. A learner\n     who only ever taps can produce a page correctly and still recite it wrongly. Audio-per-word exists in the plan; it is not enough.\n\n3   A HUMAN EAR — tasmi' (recitation to a teacher) is how hifz has always been validated. The app should say so plainly rather\n     than imply it replaces a teacher. Position: the quiz is the DAILY DRIVER; the teacher is the VERIFIER.", {
    fontSize: 11, strokeColor: T.sec,
  });
}

// ============================================================
// 22 · TEMPLATING — the question compiler
// ============================================================
sectionTitle(80, 26400, "22", "Templating: Surah → Ayah → Quiz", "Presentation, selection and foils become DATA. Retrieval logic, sequencing and grading stay CODE.");

{
  const y0 = 26540;

  // --- THE DIAGNOSIS ---
  rect(80, y0, 1350, 210, { strokeColor: T.coral, backgroundColor: T.coralBg, fillStyle: "solid", strokeWidth: 3 });
  text(100, y0 + 14, "WHAT'S ACTUALLY THERE TODAY — verified by grep, not by reading comments", { fontSize: 18, strokeColor: "#712b13" });
  text(100, y0 + 46, "There is NO template system. But the bigger finding: most of the engine I'd have templated is DEAD CODE.", { fontSize: 13, strokeColor: T.ink });
  text(100, y0 + 72, "grep for initLadder / nextItem / s1Options / bridgeItems / junctionItem across src/pages, session, db, admin, corpus, components\n→ ZERO app callers. ladder.ts (281 lines, S1/S2/S3), bridge.ts (S4), chain.ts (junction) are UNREACHABLE from the UI.", {
    fontSize: 11, strokeColor: T.sec,
  });
  text(100, y0 + 118, "THE LIVE SURFACE IS ONLY:", { fontSize: 12, strokeColor: T.coral });
  text(100, y0 + 138, "· Drill.tsx + Gate.tsx → reconstruct.ts (the RC item) — the ONLY graded path in the product\n· Test.tsx → the 6 test.ts builders — a read-only mirror that by design never moves strength", {
    fontSize: 11, strokeColor: T.ink,
  });
  text(100, y0 + 180, "⇒ Any migration that writes adapters for ladder/bridge/chain spends ~40–50% of its budget on code no learner can reach.", {
    fontSize: 11, strokeColor: "#712b13",
  });

  // --- FOUR CONFIRMED BUGS ---
  const by = y0 + 240;
  text(80, by, "FOUR DEFECTS CONFIRMED IN SOURCE — all pre-date any template work", { fontSize: 15 });
  const bugs = [
    ["B1", "The `custom` override is a LOADED no-op", "Admin.tsx:311 ships a free-text {prompt, options[], correct} editor. Laravel validates\n`payload => ['required','array']` and NOTHING inside it. overrides.ts:139 pushes it to\ncustoms[] UNRESOLVED. No renderer reads customs. Rows accumulate — and become learner-\nvisible the instant anyone builds the renderer, retroactively, with no review in between.\nAn admin can type Arabic into `correct` RIGHT NOW and it persists.", T.coral],
    ["B2", "React decides the grading rung", "Drill.tsx:203 and Gate.tsx:100 both: `const rung: Rung = item.full ? \"S3\" : \"S2\";`\nInvariant #6 (\"React never decides sequencing\") is ALREADY leaking on the most\nconsequential axis — S3 triggers scheduleGate() and grants GAIN.s3 (30) vs s2 (12).", T.coral],
    ["B3", "ayah_verifications has no content hash", "Migration 2026_07_16_040001 = unique(surah,ayah) + verified_by + note + created_at.\nA qari signs ayah 5; an admin then writes a gloss override for ayah 5; the row still\nreads verified. The GATE-A \"verified frontier\" metric is provably lying TODAY.", T.amber],
    ["B4", "applyOverrides ties are unordered", "overrides.ts:117 sorts on createdAt alone. Ties resolve by DB row order, which is not\nguaranteed — and the seeder bulk-inserts rows sharing a millisecond. overrides.test.ts\nalready asserts array order shouldn't matter; at ties that intent is unenforced.", T.amber],
  ];
  let byy = by + 26;
  bugs.forEach(([id, t, d, col]) => {
    const h = String(d).split("\n").length * 15 + 40;
    rect(80, byy, 1350, h, { strokeColor: col, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
    text(98, byy + 12, id, { fontSize: 14, strokeColor: col });
    text(140, byy + 12, t, { fontSize: 14 });
    text(140, byy + 34, d, { fontSize: 10, strokeColor: T.sec });
    byy += h + 10;
  });

  // --- THE ARCHITECTURE ---
  const ay = byy + 30;
  text(80, ay, "THE ARCHITECTURE — a closed-kernel, open-composition question compiler", { fontSize: 18 });
  text(80, ay + 26, "One pure function:  buildQuestion(spec, ctx) → RenderItem | null", { fontSize: 13, strokeColor: T.teal });

  // the split
  rect(80, ay + 52, 660, 200, { strokeColor: T.teal, backgroundColor: T.tealBg, fillStyle: "solid", strokeWidth: 2 });
  text(100, ay + 64, "DATA — admin-editable, append-only specs", { fontSize: 13, strokeColor: "#085041" });
  text(100, ay + 88, "· which words/ayat a question is ABOUT (selector)\n· which foil kernel fills the wrong options + params\n· the prompt text (EN / MS — translation, not revelation)\n· which of 4 render shapes to use\n· a difficulty offset (−1 / 0 / +1)\n· blank policy", { fontSize: 11, strokeColor: T.sec });

  rect(770, ay + 52, 660, 200, { strokeColor: T.coral, backgroundColor: T.coralBg, fillStyle: "solid", strokeWidth: 2 });
  text(790, ay + 64, "CODE — engine-owned, never templated", { fontSize: 13, strokeColor: "#712b13" });
  text(790, ay + 88, "· the SEQUENCING state machines (ladder's S1 pass,\n  reconstruct's blankIndex cursor)\n· GRADING — a spec declares no rung, no pretest,\n  no atom, no structured flag\n· the fold (rebuild.ts needs ZERO changes)\n· the 4 render shapes themselves", { fontSize: 11, strokeColor: T.sec });
  text(790, ay + 208, "\"A template that can author a state machine is an\ninterpreter — and an interpreter is where determinism dies.\"", { fontSize: 10, strokeColor: T.coral });

  // --- THE TWO HARD PROBLEMS ---
  const hy = ay + 276;

  rect(80, hy, 660, 300, { strokeColor: T.purple, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 3 });
  text(100, hy + 14, "HARD PROBLEM 1 — FOLD SAFETY", { fontSize: 15, strokeColor: T.purple });
  text(100, hy + 38, "An append-only log referencing an OPEN, EDITABLE set of\nspec ids, where tonight's fold_determinism_check must\nmatch 100% forever.", { fontSize: 11, strokeColor: T.sec });
  text(100, hy + 92, "THE RULE: the fold NEVER dereferences a spec id.", { fontSize: 13, strokeColor: T.purple });
  text(100, hy + 116, "1  `Rung` stays a CLOSED union forever. Specs never\n   extend it. rebuild.ts requires ZERO changes.\n2  The event carries a DENORMALIZED snapshot, not a\n   pointer: gradeClassToWire() resolves to a literal\n   Rung at emit time. Delete every spec tonight — no\n   past fold can change, there is nothing to look up.\n3  Grading is DERIVED FROM OBSERVATION: \"S3\" is\n   returned only when the ENGINE observed full\n   coverage. A one-tap MCQ cannot declare itself S3\n   and forge an encoding event.\n4  origin:\"admin\" specs are clamped to \"ungraded\"\n   server-side → routed to test_* events, for which\n   rebuild.ts deliberately has NO branch (v2-D14).", { fontSize: 10, strokeColor: T.sec });
  text(100, hy + 276, "This generalizes what reconstruct.ts already does: RC never\nreaches the wire; it stamps its S2/S3 equivalence class.", { fontSize: 9, strokeColor: T.teal });

  rect(770, hy, 660, 300, { strokeColor: T.purple, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 3 });
  text(790, hy + 14, "HARD PROBLEM 2 — QURAN AUTHENTICITY", { fontSize: 15, strokeColor: T.purple });
  text(790, hy + 38, "It must be impossible for an admin — or a model — to\nintroduce non-authentic Quranic Arabic.", { fontSize: 11, strokeColor: T.sec });
  text(790, hy + 78, "THE GUARANTEE: a TYPE-LEVEL impossibility, not a rule.", { fontSize: 13, strokeColor: T.purple });
  text(790, hy + 102, "· `CorpusRef` is a 5-variant union of pure COORDINATES:\n  word · verse · gloss · distractor · ayahNumber.\n  There is NO { literal: string } member.\n· Every answer/option slot is a CorpusRef, resolved by\n  the single function resolveRef(corpus, ref) — which\n  can only return bytes already in the compiled corpus.\n· An Arabic `Face` is { text, script:\"arabic\", from }\n  with `from` MANDATORY — only constructible by a kernel\n  that actually read the corpus at that coordinate.\n  Provenance is PRODUCED, not claimed.\n· A test asserts resolveRef(corpus, face.from) === face.text\n  for every Face across a full-corpus sweep.", { fontSize: 10, strokeColor: T.sec });
  text(790, hy + 266, "\"There is no field in the entire schema, at any depth, typed\n`string`, that renders as Arabic. A field that does not exist\nneeds no validator and cannot drift between TS and PHP.\"", { fontSize: 9, strokeColor: T.teal });

  // --- RENDER PRIMITIVES ---
  const ry2 = hy + 330;
  text(80, ry2, "THE RENDER CONTRACT — 4 shapes, closed PERMANENTLY", { fontSize: 15 });
  text(80, ry2 + 22, "Specs are open; shapes are not. A spec picks WHICH shape and WHAT data fills it — it can never introduce a fifth.", { fontSize: 11, strokeColor: T.muted });
  const shapes = [
    ["choice", "pick one option from N", "S1 · S2 · vocab · cloze · junction", T.teal],
    ["sequenceFill", "fill blanks in order — carries `cursor`", "S3 · RC · produce", T.teal],
    ["orderTiles", "arrange tiles — carries `attempt`", "reorder", T.purple],
    ["locateChoice", "pick an ayah NUMBER (script: ayahRef)", "locate", T.purple],
  ];
  let sx3 = 80;
  shapes.forEach(([n, d, covers, col]) => {
    rect(sx3, ry2 + 46, 330, 96, { strokeColor: col, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
    text(sx3 + 14, ry2 + 58, n, { fontSize: 14, strokeColor: col });
    text(sx3 + 14, ry2 + 80, d, { fontSize: 10, strokeColor: T.sec });
    text(sx3 + 14, ry2 + 112, "covers: " + covers, { fontSize: 9, strokeColor: T.muted });
    sx3 += 340;
  });
  note(80, ry2 + 156, 1350, "WHY FOUR AND NOT TWO — the critique that changed the design.\nOne design argued for two shapes (choice + sequence) and it survived inspection ABSTRACTLY. But in the LIVE code Test.tsx:529 (reorder) maintains a\n`reorderAttempt` accumulator with used-tile state, and Test.tsx:550 (produce) renders from ReconstructState's words/blankPositions/blankIndex. A stateless\ntwo-member union cannot express either — so both would have stayed bespoke React branches, falsifying the whole \"React branches on shape, permanently\" claim.\nThe fix: put the stateful fields INTO the render contract — sequenceFill carries `cursor`, orderTiles carries `attempt`. The closure claim is now true on arrival.", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });
}

// --- 22b · the admin surah-ayah-quiz editor ---
{
  const ey = 28380;
  sectionTitle(80, ey - 120, "22b", "Admin: the surah–ayah–quiz editor", "Three panes, one screen. Every answer slot is a word-picker — never a text input.");

  const d = desktop(120, ey, 1310, 560, "Ayah workbench", "route: /admin/content/[surah]/[ayah]", { sidebar: false, url: "iman.app/admin/content/12/4" });
  const c = d.content;

  // three panes
  const paneY = c.y + 14, paneH = 480;
  line([[c.x + 300, paneY], [c.x + 300, paneY + paneH]], { strokeColor: T.border });
  line([[c.x + 800, paneY], [c.x + 800, paneY + paneH]], { strokeColor: T.border });

  // LEFT — navigator
  text(c.x + 14, paneY, "AYAH NAVIGATOR", { fontSize: 10, strokeColor: T.muted });
  let ny2 = paneY + 20;
  [["1", "12 words", "verified", T.teal],
   ["2", "9 words", "verified", T.teal],
   ["3", "17 words", "STALE", T.amber],
   ["4", "15 words · 2 specs", "unverified", T.muted],
   ["5", "21 words", "unverified", T.muted]].forEach(([n, w2, st, col], i) => {
    rect(c.x + 14, ny2, 270, 40, {
      strokeColor: i === 3 ? T.ink : T.border,
      backgroundColor: i === 3 ? T.surface : T.white,
      fillStyle: "solid",
      strokeWidth: i === 3 ? 2 : 1,
    });
    text(c.x + 24, ny2 + 8, "Ayah " + n, { fontSize: 11 });
    text(c.x + 24, ny2 + 24, w2, { fontSize: 8, strokeColor: T.muted });
    chip(c.x + 200, ny2 + 10, st, { fontSize: 8, strokeColor: col, fg: col });
    ny2 += 46;
  });
  text(c.x + 14, ny2 + 8, "FILTERS: unverified only · has overrides\n· stale · has admin specs", { fontSize: 9, strokeColor: T.muted });
  text(c.x + 14, ny2 + 44, "This is where the GATE-A frontier becomes\nan actionable worklist, not a number.", { fontSize: 9, strokeColor: T.teal });

  // CENTRE — workbench
  text(c.x + 316, paneY, "AYAH WORKBENCH — the learner's exact rendering", { fontSize: 10, strokeColor: T.muted });
  rect(c.x + 316, paneY + 18, 470, 76, { strokeColor: T.border, backgroundColor: T.surface, fillStyle: "solid" });
  let wx2 = c.x + 326;
  ["إِذْ", "قَالَ", "يُوسُفُ", "لِأَبِيهِ"].forEach((a, i) => {
    rect(wx2, paneY + 30, 104, 40, {
      strokeColor: i === 2 ? T.teal : T.border,
      backgroundColor: i === 2 ? T.tealBg : T.white,
      fillStyle: "solid",
      strokeWidth: i === 2 ? 2 : 1,
    });
    text(wx2 + 26, paneY + 42, a, { fontSize: 15 });
    wx2 += 112;
  });
  text(c.x + 316, paneY + 102, "WORD INSPECTOR — يُوسُفُ (position 3)", { fontSize: 10, strokeColor: T.teal });
  const insp = [
    ["text_uthmani", "يُوسُفُ", "READ-ONLY, always", T.coral],
    ["lemma / root / class", "يوسف · —  · N", "READ-ONLY", T.coral],
    ["gloss.en", "\"Yusuf\"", "EDITABLE — translation, not revelation", T.teal],
    ["gloss.ms", "(empty — 0/1777)", "EDITABLE", T.amber],
    ["distractors rank 1–5", "5 ranked, with src_type + why", "EDITABLE (replace set)", T.teal],
  ];
  let iy2 = paneY + 120;
  insp.forEach(([f, v, note2, col]) => {
    rect(c.x + 316, iy2, 470, 34, { strokeColor: T.border });
    text(c.x + 326, iy2 + 6, f, { fontSize: 10 });
    text(c.x + 326, iy2 + 21, v, { fontSize: 9, strokeColor: T.sec });
    chip(c.x + 640, iy2 + 8, note2.split(" —")[0], { fontSize: 7, strokeColor: col, fg: col });
    iy2 += 40;
  });

  // RIGHT — spec editor
  text(c.x + 816, paneY, "SPEC EDITOR + LIVE PREVIEW", { fontSize: 10, strokeColor: T.muted });
  let sy3 = paneY + 20;
  rect(c.x + 816, sy3, 460, 132, { strokeColor: T.purple, backgroundColor: T.purpleBg, fillStyle: "solid", strokeWidth: 2 });
  text(c.x + 828, sy3 + 10, "SHAPE   [ choice ▾ ]   4 options only", { fontSize: 10, strokeColor: "#332a66" });
  text(c.x + 828, sy3 + 30, "PROMPT  en: \"Which word means…\"", { fontSize: 10, strokeColor: T.sec });
  text(c.x + 828, sy3 + 46, "        ms: \"Perkataan mana bermaksud…\"", { fontSize: 10, strokeColor: T.sec });
  text(c.x + 828, sy3 + 66, "        ⚠ Arabic script rejected inline,", { fontSize: 9, strokeColor: T.coral });
  text(c.x + 828, sy3 + 80, "          offending character highlighted", { fontSize: 9, strokeColor: T.coral });
  text(c.x + 828, sy3 + 100, "ANSWER  ⟨ tap a word in the centre pane ⟩", { fontSize: 10, strokeColor: T.teal });
  text(c.x + 828, sy3 + 116, "        stores a CorpusRef — NEVER a text input", { fontSize: 9, strokeColor: T.teal });
  sy3 += 146;

  rect(c.x + 816, sy3, 460, 88, { strokeColor: T.border, backgroundColor: T.white, fillStyle: "solid" });
  text(c.x + 828, sy3 + 10, "FOIL KERNELS (ordered, closed list)", { fontSize: 10, strokeColor: T.muted });
  text(c.x + 828, sy3 + 28, "1. corpusRanked   rank ≤ 4\n2. sameRoot       max 2\n3. nearestGloss   dedup ON  ← load-bearing", { fontSize: 9, strokeColor: T.sec });
  sy3 += 102;

  rect(c.x + 816, sy3, 460, 118, { strokeColor: T.teal, backgroundColor: T.tealBg, fillStyle: "solid", strokeWidth: 2 });
  text(c.x + 828, sy3 + 10, "LIVE PREVIEW — the SAME React components", { fontSize: 10, strokeColor: "#085041" });
  text(c.x + 828, sy3 + 26, "the learner sees. Rendered at 3 strengths:", { fontSize: 9, strokeColor: T.sec });
  ["strength 0", "strength 50", "strength 90"].forEach((s2, i) => {
    rect(c.x + 828 + i * 148, sy3 + 44, 138, 40, { strokeColor: T.teal, backgroundColor: T.white, fillStyle: "solid" });
    text(c.x + 838 + i * 148, sy3 + 56, s2, { fontSize: 9, strokeColor: T.teal });
    text(c.x + 838 + i * 148, sy3 + 70, "4 opts / 3 / 2", { fontSize: 8, strokeColor: T.muted });
  });
  text(c.x + 828, sy3 + 92, "+ explain() trace: which selector matched, which kernel\nfilled which slot, the resolved difficulty band.", { fontSize: 9, strokeColor: T.sec });

  text(c.x + 816, sy3 + 130, "Save is DISABLED until the spec parses.", { fontSize: 10, strokeColor: T.coral });
}

note(1460, 28460, 380, "WHAT THE ADMIN CAN DO\n· edit gloss.en / gloss.ms per word\n· replace the ranked distractor set\n· group multi-word units (أَحَدَ+عَشَرَ → \"eleven\")\n· disable a question type at ayah or position\n· AUTHOR A NEW SPEC: pick shape, write EN/MS\n  prompt, pick the answer BY TAPPING A WORD,\n  choose foil kernels with bounded params,\n  set difficulty offset, bind to an ayah\n· preview at any strength + read explain()\n· tombstone a spec (body stays resolvable\n  forever — never deleted, so old folds hold)", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

note(1460, 28720, 380, "WHAT THE ADMIN CANNOT DO — structurally\n· TYPE ARABIC into any answer or option field.\n  No such field exists in the schema.\n· author a sequencing state machine\n· declare a spec's own grading class\n  (admin specs are clamped to \"ungraded\"\n   server-side → test_* events → rebuild.ts\n   has no branch for them at all)\n· edit text_uthmani, lemma, root, or class\n· make a past fold change — tombstoning\n  removes a spec from SELECTION only", { strokeColor: T.coral, bg: T.coralBg, fg: "#712b13" });

note(1460, 28980, 380, "SHIP ORDER — bugs first, compiler second\nThe three live defects (B1 custom no-op, B3\nmissing content hash, B4 tie ordering) deliver\nuser-visible value in about ONE WEEK.\n\nThe compiler is a ~4-WEEK investment that only\npays off at roughly the TWELFTH question type.\n\nSo: fix B1–B4, add the verification content\nhash, THEN build the compiler — and build it\nagainst reconstruct.ts + test.ts only, since\nladder/bridge/chain are unreachable.", { strokeColor: T.amber, bg: T.amberBg, fg: "#7a4d0d" });

// ============================================================
// 23 · CARDINALITY, PACKAGING & PROCEDURAL EDGE CASES
// ============================================================
sectionTitle(80, 29400, "23", "One ayah → many questions", "The Site model: cardinality, deterministic variety, packaging, and edge cases as one rule.");

{
  const y0 = 29540;

  // --- THE SITE ---
  rect(80, y0, 1350, 150, { strokeColor: T.teal, backgroundColor: T.tealBg, fillStyle: "solid", strokeWidth: 3 });
  text(100, y0 + 14, "THE SPINE — a spec binds to a SITE, never to \"an ayah\"", { fontSize: 18, strokeColor: "#085041" });
  text(100, y0 + 46, "Site = { kind: \"ayah\" | \"seam\",  surah,  ayah:n }        siteToAtomKey is TOTAL:", { fontSize: 13, strokeColor: T.ink });
  text(100, y0 + 70, "   ayah → atom  ayah:n              seam(n) → atom  connection:n        ← n→n+1, ref = the FROM ayah", { fontSize: 12, strokeColor: T.teal });
  text(100, y0 + 100, "This is why \"a junction spans TWO ayat but specs bind to ONE\" never becomes a problem: the seam IS a coordinate.\nInvariant #1 is untouched — atoms stay per-ayah and per-connection. rebuild.ts's junction_result branch is unchanged.", {
    fontSize: 11, strokeColor: T.sec,
  });

  // --- CARDINALITY: three layers ---
  const cy = y0 + 180;
  text(80, cy, "CARDINALITY — three multiplications, filtered at the third", { fontSize: 16 });
  const layers = [
    ["1  SITE", "which coordinate", "ayah:n  ·  seam:n", T.teal],
    ["2  LANE", "which spec kind — the unit of rotation", "s1 · cloze · rc · junction · locate · reorder", T.purple],
    ["3  VARIANT", "enumerate, then ADMIT (fibre-aware)", "variants() enumerates; admit() judges", T.coral],
  ];
  let ly2 = cy + 24;
  layers.forEach(([n, d, e, col]) => {
    rect(80, ly2, 900, 54, { strokeColor: col, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
    text(96, ly2 + 10, n, { fontSize: 14, strokeColor: col });
    text(230, ly2 + 10, d, { fontSize: 12 });
    text(230, ly2 + 30, e, { fontSize: 10, strokeColor: T.muted });
    ly2 += 62;
  });

  note(1000, cy + 24, 430, "MEASURED ON YUSUF 12:4 (31 words)\n  s1       31 enumerated → 27 admissible\n           (4 dropped: PROMPT collision)\n  cloze    31 → 31\n  rc        4 blank-windows → 4\n  locate    1 → 1\n  reorder   1 → 1\n  seam      1 → 1\n  ────────────────────────────────\n  6 lanes · 65 admissible items\n\nAl-Asr 103:1 (ONE word): s1 1→0 (zero siblings),\ncloze 0, rc 1, locate degrades to 3-option,\nreorder 1, seam 1 ⇒ 3–4 lanes, 4 items.\nHonest, not padded.", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

  // --- DETERMINISM ---
  const dy = ly2 + 30;
  text(80, dy, "DETERMINISM — deterministic AND non-repetitive across 30+ encounters", { fontSize: 16 });

  rect(80, dy + 26, 660, 190, { strokeColor: T.coral, backgroundColor: T.coralBg, fillStyle: "solid", strokeWidth: 2 });
  text(100, dy + 38, "THE BUG ALL THREE DESIGNS HIT", { fontSize: 13, strokeColor: "#712b13" });
  text(100, dy + 60, "Every design DERIVED a visit counter by folding the log.\nAll three break, and I verified why:\n\n  db/eventLog.ts:113  mergeFromServer does\n      const { seq: _drop, ...rest } = e\n  so IndexedDB assigns a FRESH local seq.\n\n⇒ log order is ARRIVAL order. Two devices with\nbyte-identical event sets select DIFFERENT questions.\n`ts` can't rescue it (clock skew, ms ties).", { fontSize: 10, strokeColor: T.sec });

  rect(770, dy + 26, 660, 190, { strokeColor: T.teal, backgroundColor: T.tealBg, fillStyle: "solid", strokeWidth: 2 });
  text(790, dy + 38, "THE FIX — record the ordinal, don't derive it", { fontSize: 13, strokeColor: "#085041" });
  text(790, dy + 60, "Stamp `siteKey` + `visitOrdinal` onto the event AT EMIT.\nNext ordinal = max(recorded for siteKey) + 1.\n\nCommutative and set-monotone ⇒ immune to arrival\norder, immune to a late sync, immune to getAll()\nreturning [] on a wedged IndexedDB.\n\nExactly the denormalization pattern gradeClassToWire()\nalready uses for Rung. Selection becomes a WRITTEN\nFACT — a bug report replays from the log alone.", { fontSize: 10, strokeColor: T.sec });

  // rotation
  const ry3 = dy + 236;
  rect(80, ry3, 900, 130, { strokeColor: T.purple, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
  text(100, ry3 + 12, "ROTATION — lanes first, then within-lane affine cycle", { fontSize: 14, strokeColor: T.purple });
  text(100, ry3 + 36, "lap  = floor(k / L)        slot = k % L\nlane = lanes[ lapPerm(siteKey, lap, L)[slot] ]\nidx  = ( stride(N)*lap + mix32(fnv1a(siteKey+\"#\"+lane)) % N ) % N", { fontSize: 11, strokeColor: T.ink });
  text(100, ry3 + 92, "lapPerm hash-permutes the L lanes per lap ⇒ every lane fires EXACTLY ONCE per lap (no starvation, structurally),\nwhile lap ORDER differs every lap (variety). stride(N) computed in INTEGER arithmetic — no float on the selection path.", {
    fontSize: 10, strokeColor: T.sec,
  });

  note(1000, ry3, 430, "MEASURED — 12:4, 6 lanes / 65 items, 30 visits\n  · 17/30 distinct items\n  · 0 immediate repeats\n  · perfectly balanced {rc:5 s1:5 cloze:5\n    locate:5 reorder:5 junction:5}\n  · 5/5 distinct lap orders\n  · stress L=2..8 × 5 sites × 400 visits\n    → max 0 immediate repeats\n\nThe seam guard must be a ROTATION, not a swap:\nthe swap was measured failing at L=2 (no room)\n— 59 immediate repeats over 400 visits.", { strokeColor: T.purple, bg: T.purpleBg, fg: "#332a66" });

  note(1000, ry3 + 260, 430, "A NEW GATE IS REQUIRED\nThe nightly fold_determinism_check compares ATOMS\nand structurally CANNOT observe selection\ndivergence — all three designs wrongly assumed it\ncovered this for free.\n\nAdd `selection_determinism_check`: replay a\nSHUFFLED log, assert the recorded ordinals and the\nfull selection trace are byte-identical.\n\nThe shuffling is the point — it is what catches the\nmergeFromServer reordering.", { strokeColor: T.coral, bg: T.coralBg, fg: "#712b13" });
}

// --- 23b · edge cases + junction ---
{
  const ey2 = 30700;
  text(120, ey2, "23b · Edge cases as ONE RULE — admit(variant, fibre, ctx), fibre-AWARE", { fontSize: 20 });
  text(120, ey2 + 28, "No spec contains a bound check. No caller contains an if. No builder is ever called on an input admit() has not cleared.", {
    fontSize: 12, strokeColor: T.muted,
  });

  const clauses = [
    ["1", "SUPPLY", "distinctSiblingGlosses ≥ optionCount−1 · distinctDistractorsAtRank(pos,4) ≥ n−1\n· successorExists · poolAyatCount · consecutiveRun — counted on a ResourceLedger\nbuilt once per site, never hand-counted in a probe.", T.teal],
    ["2", "OPTION-SET DISTINCTNESS under NORMALIZATION", "|Set(normalize(option))| === optionCount. Promotes ladder.ts's load-bearing `seen`\nSet into the admissibility metric. Byte equality is NOT enough: 12:37 p10 \"[that]\"\nvs p12 \"That\" are indistinguishable to a reader. Normalizing catches 11 more slots.", T.amber],
    ["3", "PROMPT UNIQUENESS across the fibre  ← THE DECISIVE CLAUSE", "A variant is admissible only if its normalized PROMPT is unique among all variants\nat that site. Two designs claimed two-correct-answers was \"structurally\nunrepresentable\" — both FALSE, because both judged an item in ISOLATION while the\ndefect is a RELATION BETWEEN items sharing a site.", T.coral],
    ["4", "FALLBACK LADDER", "Escalate the answer width (3 → 5 → 8 words) rather than drop the question.\nMeasured on seams: 1-word granularity admits only 30/110; the ladder admits 110/110\nwith ZERO starvation.", T.purple],
  ];
  let cy2 = ey2 + 56;
  clauses.forEach(([n, t, d, col]) => {
    const h = String(d).split("\n").length * 15 + 44;
    rect(120, cy2, 1000, h, { strokeColor: col, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
    text(138, cy2 + 12, n, { fontSize: 15, strokeColor: col });
    text(170, cy2 + 12, t, { fontSize: 13, strokeColor: col });
    text(170, cy2 + 36, d, { fontSize: 10, strokeColor: T.sec });
    cy2 += h + 12;
  });

  note(1140, ey2 + 56, 400, "★ THE PROMPT COLLISION — verified myself\n12:6 position 18 gloss = \"before \"\n12:6 position 19 gloss = \"before \"\n\nTwo IDENTICAL prompts in one ayah. A gloss-MCQ\nbuilt naively there has TWO CORRECT ANSWERS —\nand no amount of option-list checking finds it,\nbecause the collision is in the PROMPT.\n\nMEASURED ON THE SHIPPED CORPUS:\n  175/1777 slots (9.8%) whose EN gloss repeats\n           inside its own ayah\n   63/1777 slots (3.5%) whose ARABIC surface\n           repeats inside its own ayah\n\nCost of clause 3: drops 14.2% of s1 variants.\nStarves ZERO ayat — min 4 live per ayah,\nmedian 13.", { strokeColor: T.coral, bg: T.coralBg, fg: "#712b13" });

  note(1140, ey2 + 400, 400, "THE LAST-AYAH BUG DISAPPEARS BY CONSTRUCTION\nexpand() emits seams only for a..b−1, so the seam\nat ayah 111 is NEVER CONSTRUCTED. bridge.ts:14's\nunguarded ayahWords(corpus, fromAyah + 1) has no\nreachable input.\n\nMaking the coordinate unconstructible beats a\ndefensive `if`. (Belt-and-braces: every seam spec's\nadmit() still checks successorExists.)\n\nPAGE BOUNDARY: an ordinary seam, tagged\n`crossesPage`. NOT excluded — page turns are where\nhuffaz actually break, so it is arguably the\nhighest-value seam on the page.", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

  // packaging
  const py2 = cy2 + 30;
  text(120, py2, "PACKAGING — the unit is the Site. A package is Site[] plus a budget.", { fontSize: 16 });
  const packs = [
    ["Single ayah", "[ ayah:n ]", "the drill", T.teal],
    ["Range a..b", "[ ayah:a … ayah:b ] + [ seam:a … seam:b−1 ]", "continuous drill (§13)", T.teal],
    ["Mushaf page", "the same, bounded by page geometry", "page mode (§13)", T.purple],
    ["Whole surah", "[ ayah:1 … ayah:N ] + [ seam:1 … seam:N−1 ]", "N ayat ⇒ N−1 seams, always", T.purple],
  ];
  let px2 = 120;
  packs.forEach(([n, d, u, col]) => {
    rect(px2, py2 + 26, 330, 96, { strokeColor: col, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
    text(px2 + 14, py2 + 38, n, { fontSize: 13, strokeColor: col });
    text(px2 + 14, py2 + 60, d, { fontSize: 9, strokeColor: T.ink });
    text(px2 + 14, py2 + 96, u, { fontSize: 9, strokeColor: T.muted });
    px2 += 340;
  });
  note(120, py2 + 136, 1000, "PACKAGING NEVER CHANGES HOW A QUESTION IS BUILT — only WHICH sites are in scope and how the budget is spent across them.\nThat is the whole point of making the Site the unit: §13's range/page drill, §14's calendar, and the daily scheduler all consume the SAME\nSite[] abstraction. A page is not a special case of an ayah; both are just sets of sites.", { strokeColor: T.purple, bg: T.purpleBg, fg: "#332a66" });
}

// ============================================================
// 24 · AUTH · SETTINGS · PAYWALL
// ============================================================
sectionTitle(80, 32100, "24", "Auth · Settings · Paywall", "v3-D07: hard paywall. Trial → RM20/mo (MY IP) or USD10 · lifetime RM500 / USD200.");

// 24a — register
const a1 = phone(120, 32260, "Register", "route: /register", { h: 620 });
{
  const { x, w } = a1.inner;
  let y = a1.y + 46;
  text(x, y, "Save your progress", { fontSize: 17 });
  text(x, y + 24, "You've already memorized ayah 1.\nThis keeps it safe across devices.", { fontSize: 10, strokeColor: T.muted });
  y += 62;

  rect(x, y, w, 52, { strokeColor: T.teal, backgroundColor: T.tealBg, fillStyle: "solid", strokeWidth: 2 });
  text(x + 12, y + 10, "Your anonymous progress", { fontSize: 10, strokeColor: "#085041" });
  text(x + 12, y + 28, "1 ayah · 3 reviews · will be adopted", { fontSize: 11, strokeColor: T.sec });
  y += 68;

  ["Continue with Google", "Continue with Apple"].forEach((l) => {
    btn(x, y, w, 42, l, { bg: T.transparent, fg: T.ink, strokeColor: T.ink });
    y += 50;
  });
  text(x + w / 2 - 12, y + 2, "or", { fontSize: 10, strokeColor: T.muted });
  y += 24;
  ["Email", "Password"].forEach((l) => {
    text(x, y, l.toUpperCase(), { fontSize: 8, strokeColor: T.muted });
    rect(x, y + 12, w, 34, { strokeColor: T.border, backgroundColor: T.white, fillStyle: "solid" });
    y += 56;
  });
  btn(x, y, w, 44, "Create account", { bg: T.ink });
  y += 54;
  text(x, y, "Already have one?  Sign in", { fontSize: 10, strokeColor: T.teal });
  y += 22;
  text(x, y, "No email verification wall — you're\nalready in. Verify later from Settings.", { fontSize: 9, strokeColor: T.muted });
}

// 24b — login
const a2 = phone(500, 32260, "Sign in", "route: /login", { h: 620 });
{
  const { x, w } = a2.inner;
  let y = a2.y + 46;
  text(x, y, "Welcome back", { fontSize: 17 });
  y += 40;
  ["Continue with Google", "Continue with Apple"].forEach((l) => {
    btn(x, y, w, 42, l, { bg: T.transparent, fg: T.ink, strokeColor: T.ink });
    y += 50;
  });
  text(x + w / 2 - 12, y + 2, "or", { fontSize: 10, strokeColor: T.muted });
  y += 24;
  ["Email", "Password"].forEach((l) => {
    text(x, y, l.toUpperCase(), { fontSize: 8, strokeColor: T.muted });
    rect(x, y + 12, w, 34, { strokeColor: T.border, backgroundColor: T.white, fillStyle: "solid" });
    y += 56;
  });
  btn(x, y, w, 44, "Sign in", { bg: T.ink });
  y += 54;
  text(x, y, "Forgot password", { fontSize: 10, strokeColor: T.teal });
  y += 34;

  rect(x, y, w, 92, { strokeColor: T.amber, backgroundColor: T.amberBg, fillStyle: "solid" });
  text(x + 10, y + 10, "IF THE DEVICE HAS LOCAL PROGRESS", { fontSize: 9, strokeColor: "#7a4d0d" });
  text(x + 10, y + 28, "\"This device has 4 ayat of unsynced\nprogress. Merge it into your account,\nor keep it separate?\"", { fontSize: 9, strokeColor: T.sec });
  text(x + 10, y + 74, "[ Merge ]   [ Keep separate ]", { fontSize: 10, strokeColor: T.amber });
}

// 24c — paywall
const a3 = phone(880, 32260, "Paywall", "route: /subscribe", { h: 620 });
{
  const { x, w } = a3.inner;
  let y = a3.y + 44;

  text(x, y, "Your trial has ended", { fontSize: 16 });
  text(x, y + 22, "Al-Mulk · 12 ayat memorized · 41-day streak", { fontSize: 9, strokeColor: T.muted });
  y += 48;

  rect(x, y, w, 54, { strokeColor: T.teal, backgroundColor: T.tealBg, fillStyle: "solid" });
  text(x + 10, y + 8, "Everything you've learned is SAFE.", { fontSize: 11, strokeColor: "#085041" });
  text(x + 10, y + 26, "Reviews stay open for 7 more days so\nnothing decays while you decide.", { fontSize: 9, strokeColor: T.sec });
  y += 70;

  chip(x, y, "🇲🇾 Malaysia — change", { fontSize: 9, strokeColor: T.border, fg: T.muted });
  y += 30;

  // monthly
  rect(x, y, w, 74, { strokeColor: T.ink, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
  text(x + 12, y + 10, "Monthly", { fontSize: 13 });
  text(x + 12, y + 32, "RM20", { fontSize: 22 });
  text(x + 90, y + 40, "/month", { fontSize: 10, strokeColor: T.muted });
  text(x + 12, y + 58, "cancel anytime", { fontSize: 9, strokeColor: T.muted });
  y += 86;

  // lifetime
  rect(x, y, w, 92, { strokeColor: T.purple, backgroundColor: T.purpleBg, fillStyle: "solid", strokeWidth: 3 });
  chip(x + w - 92, y + 10, "25 months", { fontSize: 8, strokeColor: T.purple, fg: T.purple, bg: T.white });
  text(x + 12, y + 10, "Lifetime", { fontSize: 13, strokeColor: "#332a66" });
  text(x + 12, y + 32, "RM500", { fontSize: 22, strokeColor: "#332a66" });
  text(x + 12, y + 60, "one payment · pays for itself if you\nstay past 25 months", { fontSize: 9, strokeColor: T.sec });
  y += 104;

  btn(x, y, w, 44, "Continue", { bg: T.ink });
  y += 54;
  text(x, y, "Not now — keep reviewing for 7 days", { fontSize: 10, strokeColor: T.muted });
}

note(1260, 32260, 380, "★ THE PAYWALL'S ONE ETHICAL OBLIGATION\n\"Everything you've learned is SAFE.\"\n\nThis app's entire thesis is RETENTION. A paywall\nthat lets a learner's memory DECAY while they\ndecide is not a paywall — it is hostage-taking\nwith someone's Qur'an.\n\nSo: reviews stay open 7 more days past the trial;\nexisting progress is NEVER deleted; and if they\nnever pay, the data waits rather than expires.\n\nCharge for ACCESS, never for the memory itself.", { strokeColor: T.coral, bg: T.coralBg, fg: "#712b13" });

note(1260, 32560, 380, "GEO-PRICING (v3-D07)\n  MY IP  → RM20/mo  ·  RM500 lifetime\n  else   → USD10/mo ·  USD200 lifetime\n\nIP sets the DEFAULT; the learner can change\nregion. No VPN enforcement theatre — a user\npaying USD10 instead of RM20 is a rounding error,\nand strict IP+card-country locking would shut out\nthe Malaysian diaspora, who are the segment MOST\nable to pay.\n\nStore the chosen region on the account, not per\nsession, so travel doesn't reprice anyone.", { strokeColor: T.amber, bg: T.amberBg, fg: "#7a4d0d" });

note(1260, 32860, 380, "LIFETIME MATH — price it deliberately\n  RM500 ÷ RM20  = 25 months\n  USD200 ÷ USD10 = 20 months\n\nLifetime only pays if learners stay past ~2\nyears — which IS the product thesis (P(recall @\n10y)). It is a coherent bet, not an accident.\n\nBut note the asymmetry: international lifetime\nbreaks even 5 months sooner. If that's not\nintended, RM500/USD250 would align them.", { strokeColor: T.purple, bg: T.purpleBg, fg: "#332a66" });

// 24d — settings
const a4 = phone(120, 32960, "Settings", "route: /me/settings", { h: 700 });
{
  const { x, w } = a4.inner;
  let y = a4.y + 44;

  const groups = [
    ["ACCOUNT", [["Email", "firdaus@…"], ["Subscription", "Lifetime · RM500"], ["Region", "Malaysia (RM)"]]],
    ["LEARNING", [["Gloss language", "English"], ["Pace", "Steady · 1 ayah/day"], ["Day starts at", "04:30"], ["Session length", "~8 min"]]],
    ["NOTIFICATIONS", [["Daily reminder", "on · 21:15"], ["Weekly summary", "off"]]],
    ["DATA", [["Export my data", "JSON"], ["Sync status", "all synced"], ["Delete account", ""]]],
  ];
  groups.forEach(([g, rows]) => {
    text(x, y, g, { fontSize: 9, strokeColor: T.muted });
    y += 18;
    rows.forEach(([l, v], i) => {
      rect(x, y, w, 38, { strokeColor: T.border });
      text(x + 12, y + 13, l, { fontSize: 11, strokeColor: l === "Delete account" ? T.coral : T.ink });
      text(x + w - 12 - String(v).length * 5.2, y + 13, v, { fontSize: 9, strokeColor: T.muted });
      y += 42;
    });
    y += 10;
  });
  tabbar(a4, "Progress");
}

note(500, 32960, 380, "SETTINGS ONLY HOLDS WHAT THE ENGINE READS\nGloss language (v2-D27), pace (v2-D09), the\nlearning-day rollover hour (daybound.ts's\nDayConfig), session length.\n\nEvery row here changes what the SCHEDULER does\ntomorrow. If a setting doesn't, it doesn't belong\n— that is the same rule §17 applies to onboarding\nquestions.\n\n\"Day starts at 04:30\" is the one that looks odd\nand is load-bearing: daybound.ts uses a secular\nearly-morning rollover, deliberately NOT a prayer\ntime (no location, no prayer-time calc).", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

note(500, 33280, 380, "EXPORT + DELETE ARE NOT OPTIONAL\nA paid app holding someone's memorization history\nMUST let them take it and leave.\n\n  · Export = the raw append-only event log as\n    JSON. It is THEIR retrieval history.\n  · Delete = real deletion, not deactivation,\n    with the 30-day grace the law expects.\n\nThis also protects the §18 footer claim (\"no\nselling data\") from becoming decorative.", { strokeColor: T.purple, bg: T.purpleBg, fg: "#332a66" });

note(500, 33540, 380, "AUTH IS ALREADY ANONYMOUS-FIRST\nv2-D03 shipped Sanctum with anonymous → account\nADOPTION. So Register is never a wall: the learner\nalready has progress, and the screen's job is to\nADOPT it, not to gate entry.\n\nHence the merge prompt on Sign-in — a returning\nlearner on a new device may have BOTH local\nanonymous progress and a server account. Silently\npicking one loses real work.", { strokeColor: T.amber, bg: T.amberBg, fg: "#7a4d0d" });

// ============================================================
// 25 · LANDING PAGE — the visual wireframe
// ============================================================
sectionTitle(80, 33900, "25", "Landing page — visual layout", "Apple's method: one idea per full-bleed section, the product IS the hero, generous negative space.");

{
  const ly3 = 34060;
  const PW = 900, PX = 140;

  // browser frame
  text(PX, ly3 - 30, "Desktop — full-bleed scroll", { fontSize: 13, strokeColor: T.muted });
  rect(PX, ly3, PW, 40, { strokeColor: T.ink, backgroundColor: T.surface, fillStyle: "solid", strokeWidth: 2 });
  [0, 1, 2].forEach((i) => ellipse(PX + 14 + i * 16, ly3 + 15, 9, 9, { strokeColor: T.muted }));
  text(PX + 80, ly3 + 13, "iman.app", { fontSize: 10, strokeColor: T.muted });

  const sections = [
    ["HERO", 300, T.ink, () => {
      const y = ly3 + 40;
      rect(PX, y, PW, 300, { strokeColor: T.border, backgroundColor: T.surface, fillStyle: "solid" });
      text(PX + 60, y + 56, "You memorized it.", { fontSize: 34 });
      text(PX + 60, y + 100, "Do you still have it?", { fontSize: 34, strokeColor: T.muted });
      text(PX + 60, y + 156, "Spaced repetition for the Qur'an. Learn a short surah,\nthen keep it — with two-minute checks scheduled exactly\nwhen you'd start to forget.", { fontSize: 13, strokeColor: T.sec });
      btn(PX + 60, y + 216, 230, 44, "Try one surah free", { bg: T.ink });
      text(PX + 60, y + 272, "No card. One surah, free.", { fontSize: 10, strokeColor: T.muted });
      // the product IS the hero — a phone, mid-tap
      rect(PX + 600, y + 30, 200, 240, { strokeColor: T.ink, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
      text(PX + 620, y + 56, "﴿ ٱلْأَيَة ﴾", { fontSize: 20 });
      [0, 1, 2].forEach((i) => {
        rect(PX + 616 + i * 56, y + 100, 48, 30, { strokeColor: i === 1 ? T.teal : T.border, backgroundColor: i === 1 ? T.tealBg : T.white, fillStyle: "solid", strokeWidth: i === 1 ? 2 : 1 });
      });
      [0, 1, 2, 3].forEach((i) => {
        rect(PX + 616 + (i % 2) * 88, y + 150 + Math.floor(i / 2) * 40, 80, 32, { strokeColor: T.ink, backgroundColor: T.white, fillStyle: "solid" });
      });
      text(PX + 616, y + 244, "one finger, mid-tap", { fontSize: 8, strokeColor: T.muted });
    }],
    ["DEMO — the conversion engine", 260, T.coral, () => {
      const y = ly3 + 340;
      rect(PX, y, PW, 260, { strokeColor: T.coral, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
      text(PX + 60, y + 40, "Try it. Right here.", { fontSize: 26 });
      text(PX + 60, y + 76, "A real drill, on this page, no install.", { fontSize: 12, strokeColor: T.muted });
      rect(PX + 60, y + 106, 480, 110, { strokeColor: T.border, backgroundColor: T.surface, fillStyle: "solid" });
      text(PX + 80, y + 130, "قُلْ  هُوَ  ____  أَحَدٌ", { fontSize: 20 });
      ["ٱللَّهُ", "ٱلَّذِى", "رَبُّ"].forEach((o, i) => {
        rect(PX + 80 + i * 100, y + 168, 88, 34, { strokeColor: T.ink, backgroundColor: T.white, fillStyle: "solid" });
        text(PX + 104 + i * 100, y + 178, o, { fontSize: 13 });
      });
      text(PX + 600, y + 130, "\"No typing. No Arabic\nkeyboard. Just tap the\nwords back into place.\"", { fontSize: 12, strokeColor: T.sec });
      text(PX + 600, y + 196, "40 seconds →", { fontSize: 11, strokeColor: T.coral });
    }],
    ["MECHANISM — three panels", 220, T.teal, () => {
      const y = ly3 + 600;
      rect(PX, y, PW, 220, { strokeColor: T.border, backgroundColor: T.surface, fillStyle: "solid" });
      [["Rebuild,\ndon't reread", "retrieval IS the practice", T.teal],
       ["The overnight\ngate", "new ayat unlock only\nafter yesterday's hold", T.coral],
       ["An honest\nnumber", "half-life 9.4 days\n72% → 64% since Thursday", T.purple]].forEach(([h, d, col], i) => {
        const cx3 = PX + 40 + i * 290;
        rect(cx3, y + 36, 250, 150, { strokeColor: col, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
        text(cx3 + 20, y + 56, h, { fontSize: 16, strokeColor: col });
        text(cx3 + 20, y + 110, d, { fontSize: 10, strokeColor: T.sec });
      });
    }],
    ["THE PLAN — calendar screenshot", 200, T.amber, () => {
      const y = ly3 + 820;
      rect(PX, y, PW, 200, { strokeColor: T.border, backgroundColor: T.white, fillStyle: "solid" });
      text(PX + 60, y + 40, "Every day's load, visible in advance.", { fontSize: 22 });
      text(PX + 60, y + 74, "The finish date recalculates honestly — we never\nshorten it to flatter you.", { fontSize: 12, strokeColor: T.sec });
      // mini calendar
      for (let i = 0; i < 28; i++) {
        const done = i < 9, today = i === 9;
        rect(PX + 560 + (i % 7) * 42, y + 40 + Math.floor(i / 7) * 34, 34, 26, {
          strokeColor: today ? T.ink : done ? T.teal : T.border,
          backgroundColor: done ? T.teal : T.white,
          fillStyle: "solid", sharp: true, strokeWidth: today ? 2 : 1,
          opacity: i > 20 ? 40 : 100,
        });
      }
      text(PX + 560, y + 178, "near days concrete · far days fade", { fontSize: 9, strokeColor: T.muted });
    }],
    ["PRICING", 230, T.purple, () => {
      const y = ly3 + 1020;
      rect(PX, y, PW, 230, { strokeColor: T.border, backgroundColor: T.surface, fillStyle: "solid" });
      text(PX + 60, y + 36, "Try one surah free. Then RM20 a month.", { fontSize: 22 });
      rect(PX + 60, y + 80, 340, 120, { strokeColor: T.ink, backgroundColor: T.white, fillStyle: "solid", strokeWidth: 2 });
      text(PX + 80, y + 96, "Monthly", { fontSize: 13 });
      text(PX + 80, y + 120, "RM20", { fontSize: 26 });
      text(PX + 80, y + 160, "USD10 outside Malaysia · cancel anytime", { fontSize: 9, strokeColor: T.muted });
      rect(PX + 430, y + 80, 340, 120, { strokeColor: T.purple, backgroundColor: T.purpleBg, fillStyle: "solid", strokeWidth: 3 });
      text(PX + 450, y + 96, "Lifetime", { fontSize: 13, strokeColor: "#332a66" });
      text(PX + 450, y + 120, "RM500", { fontSize: 26, strokeColor: "#332a66" });
      text(PX + 450, y + 160, "USD200 outside Malaysia · one payment", { fontSize: 9, strokeColor: T.sec });
    }],
    ["PROOF + FOOTER", 190, T.muted, () => {
      const y = ly3 + 1250;
      rect(PX, y, PW, 190, { strokeColor: T.border, backgroundColor: T.white, fillStyle: "solid" });
      text(PX + 60, y + 32, "Why trust the method?", { fontSize: 18 });
      text(PX + 60, y + 62, "· Ebbinghaus forgetting curve, cited\n· FSRS — the open algorithm, linked\n· \"I memorized Al-Mulk twice and lost it twice.\n   This is the app I needed the third time.\"", { fontSize: 11, strokeColor: T.sec });
      line([[PX + 40, y + 140], [PX + PW - 40, y + 140]], { strokeColor: T.border });
      text(PX + 60, y + 152, "No ads. No selling data. No dark patterns. No guilt notifications.\nYou pay us, so you are the customer — not the product.", { fontSize: 10, strokeColor: T.muted });
    }],
  ];
  sections.forEach(([label, h, col, draw]) => draw());

  // section labels down the left
  let sly = ly3 + 40;
  sections.forEach(([label, h, col]) => {
    text(PX - 56, sly + 8, "▸", { fontSize: 14, strokeColor: col });
    sly += h;
  });

  note(1100, ly3 + 40, 420, "WHAT \"LIKE APPLE\" ACTUALLY MEANS HERE\nNot glassmorphism and not big gradients — Apple's\nlanding pages are austere. The transferable rules:\n\n1  ONE IDEA PER FULL-BLEED SECTION. You scroll\n   through a sequence of single claims, never a\n   wall of features.\n2  THE PRODUCT IS THE HERO IMAGE. Apple shows the\n   device, not an illustration of it. So: a real\n   phone rendering a real ayah mid-tap.\n3  ENORMOUS TYPE, FEW WORDS. The headline is the\n   design. \"You memorized it. Do you still have\n   it?\" set at 34px+ with air around it.\n4  GENEROUS NEGATIVE SPACE. Whitespace signals\n   confidence; density signals anxiety.\n5  ONE CTA, REPEATED. Never a menu of choices.\n6  SPECIFICITY OVER ADJECTIVES. \"half-life 9.4\n   days\" beats \"powerful memory science\".", { strokeColor: T.purple, bg: T.purpleBg, fg: "#332a66" });

  note(1100, ly3 + 440, 420, "WHERE WE DEPART FROM APPLE — deliberately\nApple sells DESIRE. This sells a HABIT, to an\naudience with a private failure (\"I lost it\").\n\nSo the emotional register is CALM AND REVERENT,\nnot aspirational. No hype words, no exclamation\nmarks, no \"revolutionary\". The Amiri ayah is the\nlargest type on the page — the Qur'an outranks the\nbrand, always.\n\nAnd unlike Apple, we put a WORKING PRODUCT on the\npage (§2 demo). Apple can rely on you already\nknowing what a phone does; nobody knows what\ntap-to-reconstruct feels like until they do it.", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });

  note(1100, ly3 + 800, 420, "MOBILE = THE SAME SEQUENCE, ONE COLUMN\nEvery section reflows to a single column; the hero\nphone becomes the full-width image; the two price\ncards stack.\n\nThe demo MUST survive the reflow — it is the\nconversion engine (§18), and on mobile it is also\nthe most natural: the learner is already holding\nthe device they'd drill on.\n\nPrimary metric stays DEMO-QUALIFIED STARTS:\ncompleted the inline reconstruction AND tapped the\nCTA. Not signups, not scroll depth.", { strokeColor: T.amber, bg: T.amberBg, fg: "#7a4d0d" });
}

sectionTitle(80, 35700, "26", "Suggested build order", "What to scaffold first in v3.");

{
  const y0 = 35800;
  const steps = [
    ["1", "SURAH-KEY THE SCHEMA  (E-01)", "atomKey = `${surah}:${kind}:${ref}` + surah on AtomState. Zero UI.\nThe one decision every later step folds through — settle it before any code.", T.coral],
    ["2", "Route shell + design system", "Port iman-ui.css verbatim. App Router tree from §0.", T.ink],
    ["3", "Event log + append discipline", "IndexedDB. Events already carry surah — honour it on the READ path too.", T.teal],
    ["4", "Corpus loader (surah-agnostic)", "Lift v2's loadCorpus; drop the hardcoded SURAH = 12. Cache per surah (E-07).", T.teal],
    ["5", "Engine port — single pass", "atoms/update/rebuild/chain/scheduler. 24 test files come with it.\nApply E-01 keys, the BUG-3 chain fix, and E-03/E-08 surah scoping together.", T.teal],
    ["6", "Multi-surah dashboard", "MY SURAHS + per-surah schedules. The real new work.", T.teal],
    ["7", "Macro panel", "Ring/structure map per surah; flat 1→N grid fallback for short surahs.", T.purple],
    ["8", "Drill + chain cards", "Tap-to-reconstruct + the chain card type. Engine already ported at 5.", T.coral],
    ["9", "Continuous drill — RANGE (§13)", "Range picker over the existing chainSteps(). No engine work.\nBoth modes exposed: graded repair vs victory lap (v2-D11).", T.coral],
    ["10", "Progress list + a11y (§15)", "Semantic table, sortable/searchable, time-on-task column.\nText alternative for the ring — never colour alone.", T.purple],
    ["11", "Forecast calendar (§14)", "planFor() projected onto real dates. Measured pace, active days,\nre-forecast every session. Fix E-06 first.", T.purple],
    ["12", "DATA: mushaf geometry — HALF DONE", "Map fetched + validated + committed (v3/docs/data/yusuf-geometry.json).\nRemaining: enrich yusuf-verses.json, un-null buildCorpus.ts:54. See §13c.", T.teal],
    ["13", "Continuous drill — PAGE (§13)", "Page presets over the same chain engine. Unblocked by step 12.\nJuz/hizb units come free from the same data.", T.amber],
    ["14", "Onboarding flow (§17)", "Recall BEFORE identity. Anonymous-first is already the backend (v2-D03).", T.teal],
    ["15", "Sync outbox → Laravel", "Best-effort, idempotent by client uuid. Never blocks.", T.muted],
    ["16", "Admin console (§16)", "Desktop shell + fold_determinism_check FIRST — it monitors invariant #2.\nPseudonymous by default; reveal-with-reason is audit-logged.", T.coral],
    ["17", "Landing page (§18)", "Ship AFTER the demo drill works — the inline demo IS the conversion engine.", T.amber],
    ["18", "Feature-flag plane (§20a)", "Build BEFORE any social feature. Enable-hard / kill-easy asymmetry.\nNo social code ships without a working kill switch.", T.coral],
    ["19", "Streak calendar + rest-day covers", "streak.ts already computes it — completedDayIndices() exists (v2-D50).", T.teal],
    ["20", "Profile · friends · invites (§19)", "NEW backend: no social event types, no social tables exist yet.", T.amber],
    ["21", "Notification governance (§20c)", "Templates + dark-pattern gate BEFORE the first send.", T.amber],
    ["22", "Together-streak + XP", "Highest-risk. Ship behind holdout cohorts and measure P(recall@10y).", T.coral],
    ["23", "FIX B1–B4 (§22)", "One week, user-visible. Kill the custom no-op, add the verification\ncontent hash, fix tie ordering, move the rung out of React.", T.coral],
    ["24", "Question compiler (§22)", "~4 weeks; pays off at the ~12th question type. Build against\nreconstruct.ts + test.ts ONLY — ladder/bridge/chain are unreachable.", T.teal],
    ["25", "Admin ayah workbench (§22b)", "Three panes. Every answer slot a word-picker, never a text input.", T.purple],
    ["26", "Site model + admit() (§23)", "Sites (ayah|seam) + the fibre-aware admit() predicate. Fixes bridge.ts:14\nBY CONSTRUCTION and kills two-correct-answer questions (175/1777 slots).", T.coral],
    ["27", "Recorded visitOrdinal + rotation", "Stamp siteKey+visitOrdinal at emit (mergeFromServer drops seq!).\nAdd selection_determinism_check — the atom fold cannot see this.", T.coral],
    ["28", "Auth · settings · paywall (§24)", "Adoption not a wall (v2-D03). Paywall MUST keep reviews open 7 days —\ncharge for ACCESS, never hold someone's memory hostage.", T.amber],
    ["29", "Landing page (§25)", "Apple method: one idea per full-bleed section, product as hero.\nShip AFTER the demo drill works — the demo IS the conversion engine.", T.teal],
    ["30", "Recommender", "Last. Needs overlap data from ≥2 surahs to mean anything.", T.purple],
  ];
  // Row pitch follows the description's line count so two-line steps never clip.
  let yy = y0;
  steps.forEach(([n, t, s, col], i) => {
    const lines = String(s).split("\n").length;
    const pitch = 44 + lines * 16 + 14;
    ellipse(80, yy, 34, 34, {
      strokeColor: col,
      backgroundColor: i === 0 ? T.coralBg : T.white,
      fillStyle: "solid",
      strokeWidth: i === 0 ? 2 : 1,
    });
    text(92, yy + 9, n, { fontSize: 15, strokeColor: col });
    text(136, yy + 2, t, { fontSize: 15, strokeColor: i === 0 ? T.coral : T.ink });
    text(136, yy + 24, s, { fontSize: 11, strokeColor: T.muted });
    if (i < steps.length - 1) line([[97, yy + 34], [97, yy + pitch]], { strokeColor: T.border });
    yy += pitch;
  });

  note(760, y0 - 10, 380, "WHY E-01 IS STEP 1\nIt is a SCHEMA decision, not a feature. The\nevent log (3), the corpus loader (4) and every\nfold in the engine (5) are written against it.\n\nSettle the key shape before any of them exist\nand the fix is ~20 lines. Settle it after a\nlearner has two surahs of history and it is a\ndata migration over a log whose atoms have\nalready merged ambiguously.\n\nStep 1 ships no UI. That is the point.", { strokeColor: T.coral, bg: T.coralBg, fg: "#712b13" });

  note(760, y0 + 1260, 380, "SCOPE WARNING\nThe recommender (step 30) is the piece most\nlikely to eat the project. It only becomes\nmeaningful once a learner has 2+ surahs and\nreal overlap data.\n\nUntil then a hand-ranked list of ~15 short,\nhigh-utility surahs beats any algorithm and\ntakes an afternoon. Ship that; earn the\nalgorithm later.");

  note(760, y0 + 1500, 380, "REUSE FROM v2 (do not rewrite)\n  · engine/ — strength, decay, scheduling\n  · corpus.json — 111 ayat, 1777 words\n  · iman-ui.css — the locked design system\n  · the append-only event log pattern\n\nv3 is a new SHELL around a proven core, not a\nnew engine. The ONLY engine changes are the\nsurah-scoping fixes in §11.", { strokeColor: T.teal, bg: T.tealBg, fg: "#085041" });
}

// ============================================================
const scene = {
  type: "excalidraw",
  version: 2,
  source: "https://excalidraw.com",
  elements: els,
  appState: { gridSize: null, viewBackgroundColor: "#faf9f5" },
  files: {},
};

const out = process.argv[2];
writeFileSync(out, JSON.stringify(scene, null, 2));
console.log(`wrote ${out} — ${els.length} elements`);
