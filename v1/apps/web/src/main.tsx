import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline service worker (FR9, re-enabled in v0.8 with the correct network-first
// strategy — see public/sw.js). Register in production only; it self-updates
// (network-first HTML → no stale-bundle trap). When a NEW worker takes control
// (a fresh deploy activated via skipWaiting), reload once so a long-open tab never
// sits on an old bundle — the last-mile guard against the stale-cache class of bug.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").then((reg) => {
      // Periodically check for an updated worker while the tab stays open.
      setInterval(() => void reg.update(), 60 * 60 * 1000);
    });
  });
}
