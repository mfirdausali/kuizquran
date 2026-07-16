import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Home } from "./pages/Home.tsx";
import { SystemExplorer } from "./pages/SystemExplorer.tsx";
import "./styles/iman-ui.css";

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/system-explorer", element: <SystemExplorer /> },
]);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
