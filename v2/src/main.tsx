import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Home } from "./pages/Home.tsx";
import { Drill } from "./pages/Drill.tsx";
import { Gate } from "./pages/Gate.tsx";
import { SystemExplorer } from "./pages/SystemExplorer.tsx";
import "./styles/iman-ui.css";

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/drill", element: <Drill /> },
  { path: "/gate", element: <Gate /> },
  { path: "/system-explorer", element: <SystemExplorer /> },
]);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
