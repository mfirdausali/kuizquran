// THE ONE CLASS-JOINING HELPER.
//
// Taken from the reference project's `src/lib/cn.ts`, which is the same eight
// lines. What is NOT taken is the ecosystem that usually arrives with it:
// `clsx`, `tailwind-merge`, `cva`. Those exist to resolve CONFLICTS between
// utility classes — `px-4` losing to `px-6` — and this app has no utility
// classes to conflict. Its classes come from a locked design system where
// `.btn--primary` and `.btn--ghost` are mutually exclusive by construction and
// a "merge" would be meaningless.
//
// So: filter falsy, join with a space. A dependency would buy nothing and cost
// a bundle.

type ClassValue = string | false | null | undefined;

/** Join class names, dropping anything falsy. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
