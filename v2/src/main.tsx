import React from "react";
import { createRoot } from "react-dom/client";
import { SystemExplorer } from "./pages/SystemExplorer";

// v2 has no router yet (v2-O2: not yet scaffolded). This is the dev-only entry
// the spec asks for: a minimal hash-route table so the explorer renders at
// #/system-explorer. When the real v2 router lands, lift SystemExplorer into it
// as `src/routes/system-explorer.tsx`.
function useHashRoute(): string {
  const [route, setRoute] = React.useState(() => location.hash.slice(1) || "/system-explorer");
  React.useEffect(() => {
    const onHash = () => setRoute(location.hash.slice(1) || "/system-explorer");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

function App() {
  const route = useHashRoute();
  // Single dev route for now; the explorer is self-contained and client-side.
  if (route === "/system-explorer" || route === "/") return <SystemExplorer />;
  return <SystemExplorer />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
