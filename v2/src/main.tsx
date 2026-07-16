import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Home } from "./pages/Home.tsx";
import { Drill } from "./pages/Drill.tsx";
import { Gate } from "./pages/Gate.tsx";
import { Progress } from "./pages/Progress.tsx";
import { Test } from "./pages/Test.tsx";
import { OnboardingRoute } from "./onboarding/OnboardingRoute.tsx";
import { SystemExplorer } from "./pages/SystemExplorer.tsx";
import { useBackgroundSync } from "./sync/useBackgroundSync.ts";
import "./styles/iman-ui.css";

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/onboarding", element: <OnboardingRoute /> },
  { path: "/drill", element: <Drill /> },
  { path: "/gate", element: <Gate /> },
  { path: "/progress", element: <Progress /> },
  { path: "/test", element: <Test /> },
  { path: "/system-explorer", element: <SystemExplorer /> },
]);

// ROADMAP Phase 5: mount the sync loop once, above the router, so every route
// shares the same device identity + background flush/hydrate (v2-D03/D18).
function Root() {
  useBackgroundSync();
  return <RouterProvider router={router} />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
