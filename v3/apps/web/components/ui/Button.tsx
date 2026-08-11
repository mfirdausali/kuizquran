// BUTTON — the link/button primitive, from the reference's `ui/button.tsx`.
//
// ---------------------------------------------------------------------------
// SAME SHAPE, OPPOSITE SOURCE OF TRUTH
// ---------------------------------------------------------------------------
// The reference's Button holds its own design: a `base` string of ~8 Tailwind
// utilities plus a `variants` record spelling out background, text colour,
// border, height and hover state per variant. The component IS the styling.
//
// Here the styling already exists and is LOCKED. `.btn`, `.btn--primary` and
// `.btn--ghost` live in `app/iman-ui.css`, which is byte-gated against v1 — and
// they carry guarantees this component must not re-litigate: the 44px minimum
// tap target (edge case #82), the focus ring, and the never-colour-alone rule.
// Re-specifying a height or a hover colour here would fork the design system
// while the gate still reported green, because the gate watches the CSS file
// and not the components that use it.
//
// So `variants` maps a variant name to a LOCKED MODIFIER, not to a style. The
// component's real contribution is the same as the reference's: one place that
// decides an `href` renders a `<Link>` and no `href` renders a `<button>`, so
// no caller has to remember it.
//
// `.hit` comes from iman-ext.css and guarantees the tap area, which is why it
// is on the base and not on any one variant.

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** The two the landing page uses. Each maps to a modifier the locked
 *  stylesheet already defines — never to a style written here. */
type Variant = "primary" | "ghost";

const VARIANT_CLASS: Readonly<Record<Variant, string>> = {
  primary: "btn--primary",
  ghost: "btn--ghost",
};

export function Button({
  href,
  variant = "primary",
  className,
  children,
  ...rest
}: {
  href?: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
} & Record<`data-${string}`, string | undefined>) {
  const classes = cn("btn", VARIANT_CLASS[variant], "hit", className);

  if (href) {
    // role="button" is deliberate and is NOT redundant here: this is an anchor
    // that acts as the page's primary call to action, and the landing test
    // asserts the CTA leads into the app rather than into a form.
    return (
      <Link href={href} className={classes} role="button" {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
