import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./iman-ui.css";

// NOTE (scaffold-minimal): the full root layout is plan §B/§C's job — the
// iman-ext.css extension layer, the amiri-400 preload link, and the route
// groups. This file is deliberately the SMALLEST thing that compiles, so the
// §D IndexedDB island can be typechecked and built. It does NOT use
// next/font (plan §A4/§B2: next/font's hashed family names can never match
// the locked --font-arabic/--font-ui/--font-voice tokens).

export const metadata: Metadata = {
  title: "Iman Quiz",
  description: "Quran memorisation drill.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
