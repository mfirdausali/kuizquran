// The APP SHELL — every route a learner sees once they are inside.
//
// `(app)` is a ROUTE GROUP: the parentheses mean it contributes a layout but
// NOT a URL segment. So /home is "/home", not "/app/home". That is what lets
// the shell wrap the learner routes while "/" (the landing page, v3-D14) sits
// outside it and shows no tab bar.
//
// This is a SERVER COMPONENT. The only client thing under it is <TabBar/>,
// which needs `usePathname` to mark the current tab and nothing else. Keeping
// the shell itself on the server means a page's own RSC data (corpus, static
// content) still streams — the tab bar is an island, not a wrapper that
// forces the whole tree client-side.
//
// It reads NO IndexedDB. A layout that read the log would put every page under
// it at risk of edge case #72 (a server render has no log, so it paints 0
// while the client hydrates the real number). Log reads belong in the leaf
// client islands that own them.
//
// Structure:
//   .app-shell   column: scroll region + fixed bar
//     skip link  first focusable element, invisible until focused (§15)
//     <main>     id="main" — the skip link's target
//     <TabBar/>  fixed bottom nav; Plan replaces "You" (§14 / v3-D05)

import type { ReactNode } from "react";
import { TabBar } from "@/components/shell/TabBar";

export default function AppShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      {/* Keyboard users land here first and can jump the navigation. It is
          the first DOM node in the shell precisely so that "skip to content"
          means something. */}
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <main id="main" className="app-main">
        {children}
      </main>

      <TabBar />
    </div>
  );
}
