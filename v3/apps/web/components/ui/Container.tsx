// CONTAINER — the page-gutter primitive, from the reference's `ui/container.tsx`.
//
// ---------------------------------------------------------------------------
// WHY THIS ONE CARRIES NO MEASUREMENTS
// ---------------------------------------------------------------------------
// The reference's Container hardcodes its gutter and max width as Tailwind
// utilities: `mx-auto w-full max-w-[1200px] px-6 md:px-10`. That is the right
// call in a project whose layout lives in class names.
//
// Here it would be a SECOND layout system. `.screen` in the locked stylesheet
// already sets the page's max width, its gutters and its safe-area padding,
// and those values carry the locked file's responsive behaviour. Re-declaring
// them in a component would mean two places decide how wide the page is, and
// the day the locked file's value changes, this one silently disagrees.
//
// So the primitive's JOB here is the same — "wrap a section in the page's
// measure" — but the measurements stay in CSS where the design system owns
// them. What the component contributes is the SEMANTIC ELEMENT and the
// labelled-heading wiring, which is what every section on this page repeats.

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A landing section: the `<section>`, its anchor id, and the
 * `aria-labelledby` pointing at its own heading.
 *
 * The heading-id convention (`${id}-h`) is applied in ONE place rather than
 * retyped per section, which is how it stays correct — a section whose
 * `aria-labelledby` points at a heading that no longer exists is an
 * accessibility defect no visual review catches.
 */
export function Section({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn("landing-section", className)}
      id={id}
      aria-labelledby={`${id}-h`}
    >
      {children}
    </section>
  );
}

/** The heading of a `<Section>`, carrying the id that section points at. */
export function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <h2 id={`${id}-h`} className="landing-h2">
      {children}
    </h2>
  );
}
