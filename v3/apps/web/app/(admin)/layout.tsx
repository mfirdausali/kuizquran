// THE ADMIN SHELL — staff tooling, deliberately not the learner's shell.
//
// `(admin)` is a ROUTE GROUP: parentheses mean it contributes a layout but NOT
// a URL segment, so /workbench stays "/workbench".
//
// It renders NO TabBar. The learner's tab bar is a navigation contract with a
// learner (Home / Drill / Progress / Plan); putting staff routes beside them —
// or putting learner tabs on a staff screen — invites exactly one mistake, and
// it is the mistake WIREFRAME §16 is most emphatic about: staff surfaces and
// learner surfaces are different products with different rules. The clearest
// way to keep them apart is to give them no shared chrome at all.
//
// Like the learner shell, this is a SERVER COMPONENT and reads NO IndexedDB. A
// layout that read the log would put every route under it at risk of edge case
// #72 (a server render has no log, so it paints 0 and React keeps the zero).

import type { ReactNode } from "react";
import { AdminGate } from "@/components/admin/AdminGate";

export default function AdminShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      {/* The skip link is not a learner nicety — §15's accessibility rules
          apply to staff too, and a workbench is a keyboard-heavy screen. */}
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <main id="main" className="app-main">
        {/* THE CLIENT-SIDE ADMIN GATE (new, this run — see AdminGate.tsx's
            own header). A server component (this layout) rendering a client
            component around server-rendered `children` is a supported
            pattern; AdminGate never inspects what it wraps. */}
        <AdminGate>{children}</AdminGate>
      </main>
    </div>
  );
}
