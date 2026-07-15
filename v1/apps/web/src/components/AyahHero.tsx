// The ayah hero — the largest type on every screen (invariant #5). Renders the
// Amiri ayah via the .ayah / .ayah--display classes from iman-ui.css.

import type { CorpusWord } from "engine";

export function AyahHero({ text, display }: { text: string; display?: boolean }) {
  return <div className={display ? "ayah ayah--display" : "ayah"}>{text}</div>;
}

/**
 * S1 in-context hero: the whole ayah as the hero, dimmed (.ayah--dim), with the
 * target word lit back to primary text. Only existing iman-ui.css classes/tokens
 * are used — the container dims via .ayah--dim; the lit word restores the design
 * system's own --text-primary token (no new colors, no restyle).
 */
export function ContextAyah({
  words,
  targetPosition,
}: {
  words: CorpusWord[];
  targetPosition: number;
}) {
  return (
    <div className="ayah ayah--dim">
      {words.map((w, i) => (
        <span key={w.position}>
          <span style={w.position === targetPosition ? { color: "var(--text-primary)" } : undefined}>
            {w.text_uthmani}
          </span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </div>
  );
}

/** A gapped ayah for S2: words render in reading order (rtl), the current/filled
 *  blanks shown as .gap-slot. */
export function GappedAyah({
  words,
  filledThrough,
  blankPosition,
}: {
  words: CorpusWord[];
  /** All positions strictly before this are already filled (shown as text). */
  filledThrough: number;
  /** The active blank position. */
  blankPosition: number;
}) {
  return (
    <div className="ayah">
      {words.map((w, i) => {
        const filled = w.position < blankPosition || w.position <= filledThrough;
        const current = w.position === blankPosition;
        if (filled) {
          return (
            <span key={w.position}>
              <span className="gap-slot is-filled">{w.text_uthmani}</span>
              {i < words.length - 1 ? " " : ""}
            </span>
          );
        }
        return (
          <span key={w.position}>
            <span className={current ? "gap-slot is-current" : "gap-slot"}>
              {current ? "   " : "   "}
            </span>
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </div>
  );
}
