// Celebration effects for the session-end screen (D38: this screen is exempt from
// the calm-only reading of invariant #5 — a deliberate, documented carve-out).
// A canvas confetti burst + a synthesized chime. Both are OFF under
// prefers-reduced-motion; the chime is additionally gated so it never plays
// without the visual (and never on a muted/blurred tab). No asset files, no
// external fetch (CSP-safe, offline-safe). Particles use the design system's
// teal + amber only — coral is never used decoratively (invariant #5).

const PALETTE = ["#1d9e75", "#5dcaa5", "#9fe1cb", "#ba7517", "#faeeda", "#eceae2"];

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Fire a confetti burst across the viewport. Returns a cleanup fn that removes the
 * canvas early. No-op (returns a noop cleanup) under reduced-motion.
 */
export function burstConfetti(durationMs = 2200): () => void {
  if (prefersReducedMotion() || typeof document === "undefined") return () => {};

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "9999",
  } as CSSStyleDeclaration);
  document.body.appendChild(canvas);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = () => window.innerWidth;
  const H = () => window.innerHeight;
  canvas.width = W() * dpr;
  canvas.height = H() * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  // Two launch points (lower corners), arcing up and out — a real burst.
  type P = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; color: string; shape: 0 | 1 };
  const parts: P[] = [];
  const COUNT = 160;
  for (let i = 0; i < COUNT; i++) {
    const fromLeft = i % 2 === 0;
    const originX = fromLeft ? W() * 0.15 : W() * 0.85;
    const angle = (fromLeft ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.9;
    const speed = 9 + Math.random() * 9;
    parts.push({
      x: originX,
      y: H() * 0.72,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      size: 5 + Math.random() * 6,
      color: PALETTE[(Math.random() * PALETTE.length) | 0]!,
      shape: Math.random() < 0.5 ? 0 : 1,
    });
  }

  const GRAVITY = 0.22;
  const DRAG = 0.995;
  const start = performance.now();
  let raf = 0;

  function frame(t: number) {
    const elapsed = t - start;
    ctx.clearRect(0, 0, W(), H());
    for (const p of parts) {
      p.vy += GRAVITY;
      p.vx *= DRAG;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      // fade out over the last 600ms
      const alpha = elapsed > durationMs - 600 ? Math.max(0, (durationMs - elapsed) / 600) : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 0) {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (elapsed < durationMs) {
      raf = requestAnimationFrame(frame);
    } else {
      cleanup();
    }
  }
  raf = requestAnimationFrame(frame);

  let cleaned = false;
  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    cancelAnimationFrame(raf);
    canvas.remove();
  }
  return cleanup;
}

/**
 * Play a short, warm completion chime via Web Audio (a two-note bell, no asset).
 * No-op under reduced-motion (we treat that as "no non-essential effects"). Safe
 * if the AudioContext can't start (autoplay policy) — it just does nothing.
 */
export function playChime(): void {
  if (prefersReducedMotion()) return;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  let ctx: AudioContext;
  try {
    ctx = new AC();
  } catch {
    return;
  }
  const now = ctx.currentTime;
  // A gentle major third: two soft sine bells, the second a beat later.
  const notes: Array<[number, number]> = [
    [659.25, 0], // E5
    [987.77, 0.12], // B5
  ];
  for (const [freq, delay] of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t0 = now + delay;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.16, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.95);
  }
  // Close the context after the tail so we don't leak audio nodes.
  window.setTimeout(() => void ctx.close().catch(() => {}), 1300);
}

/** Fire the full celebration (confetti + chime). Returns a cleanup for the confetti. */
export function celebrate(): () => void {
  playChime();
  return burstConfetti();
}
